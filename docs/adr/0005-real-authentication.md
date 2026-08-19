# ADR 0005: Real authentication via Supabase Auth

- Status: Accepted; the `/demo` preservation decision below was amended by [ADR 0006](0006-remove-demo-route.md); the OAuth exclusion below was revised by [ADR 0007](0007-oauth-scaffolding.md)
- Date: 2026-08-18
- Supersedes: ADR 0004 (identity-provider constraint only; ADR 0004's other constraints for that original slice remain historically accurate)

## Context

ADR 0004 scoped the first vertical slice to synthetic data only and explicitly excluded a production connector, an identity provider, or real customer data. A repository audit was subsequently produced (P0/P1/P2/P3 backlog) and the product owner directed the project to begin real production build-out, starting with the audit's P0 #1 item: authentication. Everything downstream — real per-session authorization, a real connector, onboarding — depends on real identity existing first.

`packages/persistence`'s `users` table already models `identityProvider`/`identityProviderSubject` columns, anticipating this. The `organizations`/`users`/`memberships` RLS policies (ADR 0003) are fail-closed by design: there is no INSERT policy for `users` at all, and no way to resolve which organization an identity belongs to without already having tenant context. Real authentication requires solving that bootstrapping problem without weakening the existing tenant-isolation model.

## Decision

Use Supabase Auth as the identity provider: the project already provisions PostgreSQL through Supabase, so this adds no new vendor, and Supabase Auth's JWT integrates directly with the existing RLS/tenant model via `@supabase/ssr`.

Identity provisioning and identity-to-organization resolution are handled by two `SECURITY DEFINER` Postgres functions (`provision_identity_and_organization`, `resolve_memberships_for_identity`), both owned by a new, narrow, `NOLOGIN`, `BYPASSRLS` role (`identity_provisioner`) created solely to own them. `app_runtime` receives `EXECUTE` on the two functions only, never direct table access to `users`. A new user's first sign-in triggers automatic provisioning of one solo organization and an `owner` membership — not a full onboarding wizard, which remains future work.

The one-page command center at `/` now requires authentication and reflects the real (initially empty) attention state for the signed-in organization. The previously all-synthetic command center is preserved unchanged at `/demo`, unauthenticated, clearly labeled as a demo — nothing is deleted.

Out of scope for this decision: OAuth/social login providers, a full onboarding wizard, team invite/role-management UI, and custom password-reset UI (Supabase's default flow is used as-is).

## Consequences

Real user accounts and real organizations can now exist in the `business-dashboard-dev` Supabase project. This is still a development project, not a separate production environment, and still has no real connector — ADR 0004's prohibition on production connectors and real customer data ingestion remains in force until superseded by its own decision. Every future real Server Action must derive its tenant context from the authenticated session (via the new session Data Access Layer), never from client-supplied input, consistent with ADR 0003's requirement that RLS remain defense in depth rather than the primary authorization boundary.
