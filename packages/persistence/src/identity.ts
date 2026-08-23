import type { DatabasePool } from "./client";

/**
 * These two functions are the only sanctioned way to touch `users` or
 * resolve org membership before a transaction has tenant context (see
 * drizzle/0007_identity_provisioning.sql and ADR 0005). They are called via
 * plain `pool.query`, deliberately not `withTenantContext` — there is no
 * `app.current_organization_id` yet at this call site, and the underlying
 * Postgres functions are `SECURITY DEFINER`, owned by the narrow
 * `identity_provisioner` role, not gated by RLS.
 */

export interface ProvisionIdentityInput {
  readonly identityProvider: string;
  readonly identityProviderSubject: string;
  readonly displayName: string;
  readonly primaryEmail: string;
  /**
   * A real, pending, unexpired invite token whose email matches
   * `primaryEmail` (Phase 3, implementation roadmap) — when present and
   * valid, the new user joins that invite's organization with its role
   * instead of provisioning their own solo one. `undefined`/`null`
   * (every existing caller before this) is the function's original,
   * unchanged behavior — see `provision_identity_and_organization`'s own
   * doc comment (drizzle/0046) for why this couldn't be a second,
   * parallel function instead.
   */
  readonly inviteToken?: string | null;
}

export interface ProvisionIdentityResult {
  readonly organizationId: string;
  readonly userId: string;
}

/**
 * Creates a new user and either joins a real pending invite's
 * organization (see `inviteToken` above) or provisions a solo
 * organization for them, with a real membership either way, all in one
 * atomic call. In production this runs automatically via the
 * `on_auth_user_created` trigger on `auth.users`; tests call it directly
 * to seed a real identity, since `users` has no ordinary INSERT policy
 * for app_runtime to use instead.
 */
export async function provisionIdentityAndOrganization(
  pool: DatabasePool,
  input: ProvisionIdentityInput,
): Promise<ProvisionIdentityResult> {
  const result = await pool.query<{
    organization_id: string;
    user_id: string;
  }>(
    `select organization_id, user_id
     from provision_identity_and_organization($1, $2, $3, $4, $5)`,
    [
      input.identityProvider,
      input.identityProviderSubject,
      input.displayName,
      input.primaryEmail,
      input.inviteToken ?? null,
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("provision_identity_and_organization returned no row");
  }

  return { organizationId: row.organization_id, userId: row.user_id };
}

export interface IdentityMembership {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
  readonly status: string;
}

/**
 * Resolves which organization (if any) a real, already-authenticated
 * identity belongs to. Returns `null` for an identity that has never been
 * provisioned. Today's model is one auto-provisioned solo org per user, so
 * the first active membership is authoritative; a future multi-org identity
 * would need this to return every row instead of just one.
 */
export async function resolveOrganizationForIdentity(
  pool: DatabasePool,
  identityProvider: string,
  identityProviderSubject: string,
): Promise<IdentityMembership | null> {
  const result = await pool.query<{
    organization_id: string;
    user_id: string;
    role: string;
    status: string;
  }>(
    `select organization_id, user_id, role, status
     from resolve_memberships_for_identity($1, $2)`,
    [identityProvider, identityProviderSubject],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
  };
}
