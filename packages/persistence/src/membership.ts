import type { PoolClient } from "pg";

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
