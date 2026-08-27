import { randomUUID } from "node:crypto";

import { insertAuditEvent } from "./audit-events";
import type { DatabasePool } from "./client";
import { resolveMembershipId } from "./membership";
import { withTenantContext } from "./tenant-context";

/**
 * Real multi-member invites (Phase 3, implementation roadmap) — the
 * prerequisite for the existing `owner|admin|member|viewer` RBAC enum to
 * mean anything (every real org has exactly one member without this).
 * `role` never includes `owner` — an invite can't mint a second owner,
 * matching `organization_invites_role_allowed`'s own check constraint.
 */
export type InviteRole = "admin" | "member" | "viewer";
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface OrganizationInvite {
  readonly id: string;
  readonly organizationId: string;
  readonly email: string;
  readonly role: InviteRole;
  readonly status: InviteStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

interface OrganizationInviteRow {
  readonly id: string;
  readonly organization_id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
  readonly expires_at: Date;
  readonly created_at: Date;
}

function toInvite(row: OrganizationInviteRow): OrganizationInvite {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role as InviteRole,
    status: row.status as InviteStatus,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreateOrganizationInviteInput {
  readonly email: string;
  readonly role: InviteRole;
}

export interface CreateOrganizationInviteResult {
  readonly invite: OrganizationInvite;
  /**
   * The real, single-use token — returned only once, at creation, never
   * stored anywhere retrievable afterward (the row itself never exposes
   * it back out through `listOrganizationInvites`). The caller is
   * responsible for putting it in the invite email immediately.
   */
  readonly token: string;
}

/**
 * Creates a real, pending invite. `userId` must resolve to a real
 * membership in `organizationId` (the inviter) — enforced the same way
 * `createInternalTask` resolves its actor's membership, not trusted from
 * the caller. Authorization (only an owner/admin may invite) is the
 * caller's responsibility (the Server Action), not this function's — the
 * same division of labor every other real write in this app already
 * uses (RLS for tenant isolation, application code for role checks).
 *
 * Real gap found by review: the audit event for this write used to be
 * recorded by a separate `recordAuditEvent` call in the calling Server
 * Action, after this transaction already committed — unlike every other
 * "create/update a row and record a real audit event" function in this
 * package (`updateOrganizationBusinessProfile`/`updateConnectorSettings`/
 * `createGoal`/`createInternalTask`), which all write the audit event
 * inside the same transaction as the state change. `organization_invites`
 * controls who can join and access a tenant's data, making this one of
 * the more security-relevant writes to have left durably separable from
 * its own audit trail. Fixed to match the established same-transaction
 * pattern: a failure here rolls back the invite too, instead of leaving
 * a committed invite with no audit record.
 */
export async function createOrganizationInvite(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  input: CreateOrganizationInviteInput,
): Promise<CreateOrganizationInviteResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const membershipId = await resolveMembershipId(
      client,
      organizationId,
      userId,
    );
    const token = randomUUID();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
    const email = input.email.trim().toLowerCase();

    const result = await client.query<OrganizationInviteRow>(
      `insert into organization_invites
         (id, organization_id, invited_by_membership_id, email, role, token, status, expires_at)
       values ($1, $2, $3, $4, $5, $6, 'pending', $7)
       returning id, organization_id, email, role, status, expires_at, created_at`,
      [id, organizationId, membershipId, email, input.role, token, expiresAt],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("organization_invites insert returned no row");
    }

    await insertAuditEvent(client, organizationId, {
      userId,
      eventType: "invite.created",
      subjectType: "organization_invite",
      subjectId: row.id,
      outcome: "succeeded",
      metadata: { email, role: input.role },
    });

    return { invite: toInvite(row), token };
  });
}

const MAX_LISTED_INVITES = 100;

/**
 * Newest-first, real invites for one organization — a `pending` row past
 * its own `expiresAt` is effectively expired but its stored `status`
 * still literally says `pending` until something explicitly transitions
 * it, which nothing does (no background job exists in this app — see
 * Phase 1's identical synchronous-reconciliation constraint). Callers
 * that need to *display* an honest "expired" label should compare
 * `expiresAt` to the current time themselves, the same "derived, never
 * persisted" pattern `computeConnectorHealth` already established, rather
 * than trusting `status` alone.
 */
export async function listOrganizationInvites(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly OrganizationInvite[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<OrganizationInviteRow>(
      `select id, organization_id, email, role, status, expires_at, created_at
       from organization_invites
       where organization_id = $1
       order by created_at desc
       limit ${MAX_LISTED_INVITES}`,
      [organizationId],
    );

    return result.rows.map(toInvite);
  });
}

/**
 * Revokes a real pending invite — a no-op (returns `false`) for an
 * already-accepted/revoked one, never an error, matching this app's
 * general idempotent-write convention. Authorization (only an owner/admin
 * may revoke) is the caller's responsibility, same as creation.
 *
 * Real gap found by review: same as `createOrganizationInvite`'s own doc
 * comment — the audit event used to be recorded by a separate call after
 * this transaction already committed, unlike this package's established
 * same-transaction pattern. `userId` is a new required parameter (this
 * function previously took none) since a real audit event needs a real
 * actor; the honest `revoked` boolean is recorded either way, not
 * fabricated as `true` for a no-op on an already-gone invite.
 */
export async function revokeOrganizationInvite(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  inviteId: string,
): Promise<boolean> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query(
      `update organization_invites
       set status = 'revoked', updated_at = now()
       where organization_id = $1 and id = $2 and status = 'pending'`,
      [organizationId, inviteId],
    );

    const revoked = (result.rowCount ?? 0) > 0;

    await insertAuditEvent(client, organizationId, {
      userId,
      eventType: "invite.revoked",
      subjectType: "organization_invite",
      subjectId: inviteId,
      outcome: "succeeded",
      metadata: { revoked },
    });

    return revoked;
  });
}

export interface PendingInvitePreview {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly email: string;
  readonly role: InviteRole;
}

/**
 * Pre-authentication token validation, for the signup page to show "You
 * were invited to join {org}" and pre-fill the invited email — real,
 * plain `pool.query`, deliberately not `withTenantContext`, mirroring
 * `identity.ts`'s two functions: there is no tenant context yet for an
 * unauthenticated visitor. Backed by `validate_organization_invite_token`
 * (drizzle/0046), a `SECURITY DEFINER` function owned by the same narrow
 * `identity_provisioner` role `identity.ts` already uses — this never
 * mutates anything; real acceptance only happens inside
 * `provisionIdentityAndOrganization` at signup time, atomically with
 * creating the real membership.
 */
export async function validateInviteToken(
  pool: DatabasePool,
  token: string,
): Promise<PendingInvitePreview | null> {
  const result = await pool.query<{
    organization_id: string;
    organization_name: string;
    email: string;
    role: string;
  }>(
    `select organization_id, organization_name, email, role
     from validate_organization_invite_token($1)`,
    [token],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    email: row.email,
    role: row.role as InviteRole,
  };
}
