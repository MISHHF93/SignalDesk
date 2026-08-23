-- Real, shared, cross-instance rate-limit state (Phase 0 of the
-- implementation roadmap) — replaces the in-memory `Map` in
-- `apps/web/app/_lib/rate-limit.ts`, explicitly documented there as
-- single-process-only and silently ineffective the moment this app runs
-- as more than one server instance (the concrete trigger: choosing a
-- production deployment target).
--
-- Deliberately NOT a tenant table: no RLS, no `organization_id` column.
-- A rate-limit key is sometimes IP-based and pre-authentication (sign-in,
-- sign-up, guest access — `apps/web/app/_actions/auth.ts` — before any
-- tenant context can exist at all), sometimes organization-scoped only by
-- convention of the key string itself (e.g.
-- `start-checkout:${organizationId}`). RLS's per-tenant model doesn't
-- apply to a key namespace that isn't itself tenant data, and forcing it
-- here would make the pre-auth call sites impossible to serve. No
-- business information is ever stored — only a count and a window start
-- per opaque string key. Still hardened the same way every other table in
-- this schema is: revoked from the PostgREST-exposed roles, granted only
-- to the one app role that needs it.
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

revoke all on public.rate_limit_buckets from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update on public.rate_limit_buckets to app_runtime;
