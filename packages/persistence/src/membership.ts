import type { PoolClient } from "pg";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Resolves the caller's real membership id within an already-tenant-scoped
 * transaction — the thing `audit_events.actor_membership_id` needs to
 * attribute an action to a specific member, not just an organization.
 * Throws if the user has no membership in this organization; callers
 * always run this inside `withTenantContext`, so RLS already confirms the
 * membership row (if any) belongs to the current tenant.
 */
export async function resolveMembershipId(
  client: PoolClient,
  organizationId: string,
  userId: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `select id from memberships where organization_id = $1 and user_id = $2 limit 1`,
    [organizationId, userId],
  );
  const membership = result.rows[0];

  if (!membership) {
    throw new Error(
      `No membership found for user ${userId} in organization ${organizationId}`,
    );
  }

  return membership.id;
}

/**
 * Ownership Engine (Prompt 29, docs/product-vision-backlog.md, ADR 0039)
 * — the one real, deterministic resolution strategy available without any
 * new data: a case-insensitive exact match between a source system's raw
 * assignee/owner display name (e.g. an Asana `assigneeName`) and a real
 * member's own `users.display_name`. Returns `null`, not a guess, for
 * anything short of an exact match — no fuzzy/partial matching, since a
 * wrong ownership attribution is worse than an honestly unresolved one.
 * A real invite flow now exists (`invites.ts`, Phase 3, implementation
 * roadmap), so an organization can have more than one real member —
 * exact-match resolution stays exactly this narrow deliberately: a second
 * member whose source-system name doesn't precisely match their
 * `display_name` (a nickname, a typo, a different casing than expected)
 * will honestly resolve to `null` rather than a guessed match, same as
 * before.
 */
export async function resolveMembershipIdByDisplayName(
  client: PoolClient,
  organizationId: string,
  displayName: string | null,
): Promise<string | null> {
  if (!displayName || displayName.trim().length === 0) {
    return null;
  }

  const result = await client.query<{ id: string }>(
    `select m.id
     from memberships m
     join users u on u.id = m.user_id
     where m.organization_id = $1 and lower(u.display_name) = lower($2)
     limit 1`,
    [organizationId, displayName.trim()],
  );

  return result.rows[0]?.id ?? null;
}

export type MembershipRole = "owner" | "admin" | "member" | "viewer";

export interface OrganizationMember {
  readonly membershipId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly role: MembershipRole;
  readonly status: string;
}

interface OrganizationMemberRow {
  readonly membership_id: string;
  readonly user_id: string;
  readonly display_name: string;
  readonly email: string | null;
  readonly role: string;
  readonly status: string;
}

const MAX_ORGANIZATION_MEMBERS = 500;

/**
 * Every real member of one organization (Phase 3, implementation
 * roadmap) — the team roster a real invite flow needs a place to render.
 * Before this phase every real org had exactly one row here (the
 * auto-provisioned owner); this is the first real caller with a genuine
 * reason to expect more than one. Capped like every other "real set" list
 * in this app (`listGoals`, `listOverdueInvoices`) — oldest-joined first,
 * so a roster this large would truncate newer joins rather than silently
 * hide the founding members.
 */
export async function listOrganizationMembers(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly OrganizationMember[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<OrganizationMemberRow>(
      `select m.id as membership_id, m.user_id, u.display_name, u.primary_email as email,
              m.role, m.status
       from memberships m
       join users u on u.id = m.user_id
       where m.organization_id = $1
       order by m.created_at asc
       limit ${MAX_ORGANIZATION_MEMBERS}`,
      [organizationId],
    );

    return result.rows.map((row) => ({
      membershipId: row.membership_id,
      userId: row.user_id,
      displayName: row.display_name,
      email: row.email,
      role: row.role as MembershipRole,
      status: row.status,
    }));
  });
}
