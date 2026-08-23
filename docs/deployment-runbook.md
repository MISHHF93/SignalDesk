# Deployment runbook (Vercel)

- Status: real, executable procedure for this app's actual current state —
  not aspirational. Every command here is one already used and verified
  during this session (`pnpm check`, `pnpm test:production`, the Supabase
  MCP migration flow) or newly added alongside this document
  (`/api/health`, `apps/web/vercel.json`).
- See ADR 0049 for why Vercel was chosen and what it made concrete
  (the rate-limit and checkout-concurrency fixes). This document is the
  operational half that ADR deliberately left for "whenever this app is
  actually deployed."

## One-time project setup (owner action, not automatable from here)

1. Create the Vercel project from this Git repository.
2. **Root Directory: `apps/web`.** This is a pnpm workspace monorepo —
   Vercel's installer walks up from the Root Directory to find the
   workspace root (`pnpm-lock.yaml`) automatically, so this single
   dashboard setting is sufficient; no custom `installCommand`/
   `buildCommand` override is needed. `apps/web/vercel.json` (security
   headers, framework hint) is read relative to this Root Directory.
3. Framework preset: Next.js (auto-detected).
4. Node.js version: match whatever `apps/web/package.json`'s `engines`
   field specifies, or the repo's current local Node version if unset —
   confirm before first deploy, since an unset field means Vercel's own
   default, not a value this repo has actually pinned.
5. Set every environment variable from the checklist below, for the
   Production environment (and Preview, if preview deployments should also
   run against real or sandboxed values — decide per variable, not
   uniformly; see the per-variable notes).

## Environment variable checklist

Source of truth: `.env.example` (repo root). Every variable there is
required or optional exactly as its own comment states — this section
only adds deployment-specific notes, it does not restate `.env.example`.

**Fails startup if missing** (`apps/web/instrumentation.ts`'s `register()`
throws before the server accepts any request): `DATABASE_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

**Everything else is individually optional** — each feature it gates
degrades to an honest disabled/unconfigured state (never a fake success)
when unset, per this repo's own established convention (see
`connector-icons.tsx`'s doc comment for the same honesty pattern applied
to logos). `instrumentation.ts` also warns (not fails) on a half-set
OAuth client id/secret pair for every connector — a real signal that one
var was set and its partner forgotten, not an intentional partial
configuration.

**`DATABASE_URL` must be the least-privilege `app_runtime` role**
(`packages/persistence/sql/provision_app_role.sql`), never the Supabase
migration/owner connection string — `app_runtime` has no
`BYPASSRLS`/`DELETE`-everywhere grants, which is what makes the forced RLS
policies actually bind in production. Get it from Supabase's connection
pooler (transaction mode, port 6543) — this app's advisory-lock code
(`withAdvisoryLock`, ADR 0049) is specifically written to be safe against
that pooling mode; a direct/session-mode connection string would also
work but loses the pooler's own scaling behavior for no benefit.

**Never set any of these with a `NEXT_PUBLIC_` prefix** — doing so would
bundle it into client-side JavaScript, shipped to every visitor's browser:
every `_CLIENT_SECRET`, `_SECRET_KEY`, `DATABASE_URL`,
`SUPABASE_SERVICE_ROLE`-anything (this app doesn't use a service-role key
at all — see the tenant-isolation note below), `ANTHROPIC_API_KEY`,
`RESEND_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN`.
The three key-shaped vars that are deliberately `NEXT_PUBLIC_`
(`_SUPABASE_URL`, `_SUPABASE_PUBLISHABLE_KEY`, `_STRIPE_PUBLISHABLE_KEY`)
are safe to expose by design — a publishable/anon key, not a secret. The
other two real `NEXT_PUBLIC_` vars (`_APP_NAME`, `_ENABLED_OAUTH_PROVIDERS`
— see the audit below) are safe for the same reason but aren't keys at
all: a display string and a comma-separated feature list.

## Secret-exposure audit (done this pass, not assumed)

- Grepped every `NEXT_PUBLIC_` usage in `apps/web` — the only five are
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_NAME`,
  `NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS` — all five are meant to be public
  (a publishable/anon key, a display name, a comma-separated feature list),
  none is a secret. Re-grepped 2026-08-23 to confirm this list hasn't
  drifted since this session's many later changes to `apps/web` — it
  hasn't; still exactly these five.
- Every OAuth client secret, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`,
  `RESEND_API_KEY`, `DATABASE_URL`, and `STRIPE_WEBHOOK_SECRET` is read
  only in server-only modules (`_lib/*-config.ts`, Server Actions, Route
  Handlers) — none is imported from a `"use client"` file. No secret value
  is ever placed in a Server Action's return value, an API response body,
  or a rendered prop — every status check returns only booleans/labels
  (`isConfigured()`, `{connected: boolean, updatedAt}` for the AI-provider
  panel, `externalAccountLabel`), matching the pattern already established
  for every OAuth connector's own "never show token material" convention.
- No `console.log`/structured log statement anywhere in `apps/web`/
  `packages/*` prints a raw secret, token, or `DATABASE_URL` value — the
  few places that log connector errors (`describeActionError`, connector
  health status) surface provider-returned error _messages_, never
  request headers/bodies containing credentials.
- No secret reaches a repository file: every credential in
  `apps/web/.env.local` is blank in this environment (verified — it's a
  real, git-ignored local file, not committed), and `.env.example` only
  ever documents variable _names_, never real values.

## Build, migrate, deploy, verify — in this order

1. **Migrate first, always before the new code that depends on the new
   schema goes live.** Via the established Supabase MCP flow
   (`mcp__claude_ai_Supabase__apply_migration`), one migration file at a
   time, in strict chronological order, verifying success before the
   next — the same procedure already used for this session's real
   31-migration dev→production sync. Never hand-apply SQL directly against
   production. `pnpm db:check` (root `package.json`) must be clean first.
2. **Build**: `pnpm --filter @signaldesk/web build` (what Vercel itself
   runs). Must be clean — this repo's own discipline (`pnpm check`, the
   composite script) runs format/lint/typecheck/test/db:check/build
   together; run it locally before pushing what will deploy.
3. **Deploy**: push to the branch Vercel is watching for Production
   deploys (or `vercel --prod` from the CLI, if used instead of Git
   integration). Vercel builds inside `apps/web` per the Root Directory
   setting above.
4. **Post-deploy smoke test**: `pnpm test:production` (root
   `package.json`) defaults to launching its own local `next start` and
   exercising `SMOKE_ROUTES`/`LOAD_TEST_ROUTES` against `localhost` — that
   mode verifies _this build_, not _the live deployed URL_. For the actual
   live deployment, pass the real domain instead:
   `node apps/web/scripts/production-readiness-check.mjs --url
https://your-deploy.vercel.app` — no local server is spawned in this
   mode, and the load-test pass is skipped by default against real
   production traffic (pass `--load` to opt into it deliberately, since a
   10-connection/10s burst against a live deployment is a real load test,
   not a smoke test). Re-verified 2026-08-23: this mode is real and
   already implemented (`REMOTE_URL`/`--url` in the script itself), not
   the "still needed" gap an earlier pass of this document described —
   that gap closed before this document was updated to say so.
5. **Verify `/api/health`** (new, added alongside this document) returns
   `200 {"status":"ok"}` against the live URL — confirms the deployed
   instance can actually reach the production database, not just that it
   booted.

## Rollback procedure

- **Application code**: Vercel's own "Instant Rollback" (dashboard →
  Deployments → promote a previous deployment) — this is real,
  Vercel-native, and requires no custom scripting; it swaps traffic back
  to a previous build's static/serverless output immediately.
- **Database migrations are not automatically reversible.** This repo has
  no down-migration tooling — every migration in
  `packages/persistence/drizzle/` is forward-only. If a deploy needs
  rolling back and its migration already ran, rolling back the
  _application_ code alone can leave it running against a schema shape it
  doesn't expect (the classic N-1-code-against-N-schema problem). Honest
  current state: a genuine schema-rollback plan does not exist yet — the
  practical mitigation used successfully throughout this session is
  writing migrations additively (new nullable columns, new tables) so
  last-known-good application code keeps working unmodified against the
  new schema, making code-only rollback safe in the common case. A
  migration that isn't purely additive (a `NOT NULL` column, a dropped
  column, a renamed table) needs a deliberate, reviewed reverse migration
  written _before_ it ships, not improvised after an incident — this is a
  real, named process gap, not something this document invents a fake
  answer for.

## Error monitoring / structured logging

**Honest current state: neither exists yet.** No Sentry/OpenTelemetry/
Datadog/equivalent APM is wired into this codebase (verified — no such
package in any `package.json`, no instrumentation calls beyond
`instrumentation.ts`'s own startup env validation). Errors currently
surface only as: Vercel's own function logs (stdout/stderr, retained per
Vercel's plan-dependent retention window), `describeActionError`'s
user-facing messages, and `audit_events`/`internal_cost_events` rows for
the specific domains that already write them. This is a real gap for
running a production launch blind to error rates/latency regressions —
see `LAUNCH-BLOCKERS.md`.
