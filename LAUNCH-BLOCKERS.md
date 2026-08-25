# Launch blockers

- **Update (2026-08-24)**: `SIGNALDESK_SYSTEM_CERTIFICATION.md`'s full
  6-phase certification + adversarial red-team pass (Passes 1-7,
  including a later continuation session that added five real connector
  writes, a Pre-Flight Policy Audit, deterministic recovery
  classification, and Matter grouping/batch-draft) found **zero new
  P0/P1 blockers** beyond what's already listed below — every item here
  is still genuinely open, none is stale, and nothing new was added.
  Every one of #1-#5 below is still `OWNER_ACTION_REQUIRED` — see
  `OWNER-ACTIONS.md` for the concrete external steps.
- Snapshot date: 2026-08-21. Only genuine, currently-open blockers — see
  `docs/launch-readiness.md` for the full classification matrix this list
  is drawn from, and for everything that's already `VERIFIED` and not
  repeated here.
- Ordering: P0 = blocks a real customer completing the Golden Path or
  exposes the business to real operational/legal risk at launch. P1 =
  needed for a trustworthy, complete launch but doesn't block a first
  real customer succeeding. P2 = real gaps, safe to launch without.
- **Already fixed this pass** (not listed below — see
  `docs/launch-readiness.md` for detail):
  `deleteOrganizationAction` was missing Salesforce/Xero/Jira/Zendesk from
  its disconnect map (real Vault tokens would have been orphaned on
  account deletion); `.env.example` was missing `ZENDESK_CLIENT_ID`/
  `ZENDESK_CLIENT_SECRET`/`QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN`;
  `instrumentation.ts`'s half-set-credential warning didn't cover
  Salesforce/Xero/Jira/Zendesk; `apps/web/package.json` had no pinned
  Node version; `production-readiness-check.mjs` could only test a local
  build, never a real deployed URL; no `/api/health` endpoint existed;
  password recovery ("forgot password") did not exist at all; no
  provider-neutral error-reporting seam existed (see #3 below — the seam
  is now real, only the vendor remains owner-gated); no way existed to
  enumerate organizations for a scheduled job (migration 0055b) and no
  scheduled Morning Business Agent existed at all (now real —
  `/api/cron/morning-brief`, wired into `apps/web/vercel.json`); no
  `PRODUCTION-ACTIVATION-CHECKLIST.md`, `OWNER-ACTIONS.md`,
  `docs/connector-production-certification.md`, or repeatable
  `launch-canary.mjs`/`docs/production-golden-path-report.md` existed;
  no billing state reconciliation sweep existed (see former #8 — now real:
  `/api/cron/billing-reconciliation`, migration 0056's
  `list_stripe_linked_subscriptions()` cross-tenant read, and the
  `mapStripeSubscriptionToSyncFields` mapping the webhook and the sweep
  both now share — SELF-HEALING-AUDIT.md Iteration 2 has the full design
  rationale). Like the Morning Business Agent, this only actually runs
  once the app is deployed to Vercel with `CRON_SECRET` set — the same
  owner action #1's shortest path already requires, not a new one.

## P0 — blocks a real customer's Golden Path, or real operational risk

### 1. No real OAuth developer app registered for any connector

- **Subsystem**: every connector in `packages/integrations/src` (all 14
  `foundation-preview` entries); config in `apps/web/app/_lib/*-config.ts`;
  values in `.env.example` / production env vars.
- **Owner action, not autonomous**: registering a developer app with each
  provider (HubSpot, Google, Slack, Intuit/QuickBooks, Asana, Microsoft,
  Atlassian/Jira, Xero, Salesforce, Zendesk, Stripe Connect, Linear) is an
  external-account action nobody but the product owner can do.
- **Shortest path**: for the Tier-1 Launch Connector Set alone (Gmail,
  Slack, HubSpot, QuickBooks, Asana, Google Calendar) — 5 real developer-
  app registrations (Google covers both Gmail and Calendar with one app).
  Each connector's own detail page already lists the exact redirect URI
  and required scopes (see "Developer setup required" on
  `/integrations/{slug}`) — follow those instructions literally, set the
  resulting client id/secret pairs as production env vars, redeploy.
- **Why P0**: every step of the Golden Path past "connect a system" is
  `BLOCKED` on this — it is the single largest blocker in this document.

### 2. No real `ANTHROPIC_API_KEY`

- **Subsystem**: `apps/web/app/_lib/agent-config.ts`,
  `packages/application/src/ai/claude-provider.ts`.
- **Owner action**: get a real key at
  `https://console.anthropic.com/settings/keys`, set
  `ANTHROPIC_API_KEY` and `AGENT_FABRIC_ENABLED=true` as production env
  vars (or have an organization set its own key via `/profile`'s AI
  Providers panel — already built, no engineering needed either way).
- **Shortest path**: set the env var, then run the existing, already-
  built test path — trigger "Investigate risk" against a real seeded
  overdue invoice/task and confirm a real Claude-backed finding is
  produced, reconciled, and reaches the approval gate.
- **Why P0**: the user's own stated bar for this pass is a real AI chain
  test (event → entity → evidence → Signal → AI interpretation → owner →
  action → approval → execution → verification) — currently impossible to
  run for real without this.

### 3. No real error-monitoring vendor wired in

- **Subsystem**: `packages/application/src/observability/error-reporter.ts`
  (the real, provider-neutral `ErrorReporter` interface, added this
  pass — mirrors the exact `AIProvider` seam pattern) — routed through
  `describe-action-error.ts`, the one shared helper nearly every Server
  Action's catch block already calls, so every one of those already
  reports through this seam. Only a console-based default implementation
  exists; no real vendor is wired in.
- **Owner action**: pick a vendor (Sentry's Next.js SDK is the path of
  least friction for this exact stack), create a project, get a DSN.
- **Solvable autonomously by Claude, once the DSN exists**: implementing
  one adapter (e.g. `SentryErrorReporter`) against the already-real
  `ErrorReporter` interface is a single new file, not an architecture
  change.
- **Why still P0**: until a real vendor is wired in, production errors
  still only surface as Vercel's own function logs — the seam existing
  doesn't yet mean anyone is notified of a real incident.

### 4. ~~Vercel project not yet created / configured~~ — RESOLVED 2026-08-23

- **Subsystem**: deployment, see `docs/deployment-runbook.md`.
- **What actually happened**: the Vercel project, Root Directory
  (`apps/web`), and both `NEXT_PUBLIC_SUPABASE_*` vars were already set
  from earlier this session. The one missing piece —
  `DATABASE_URL` — is now resolved: rotated the `app_runtime` role's
  password on the production Supabase project
  (`ALTER ROLE app_runtime WITH PASSWORD ...`, the same sanctioned
  operation `packages/persistence/sql/provision_app_role.sql` documents
  for this exact purpose), constructed the transaction-pooler
  connection string, verified it with a real `pg` connection before
  using it (`current_user: app_runtime`), and set it on Vercel as a
  Sensitive/Secret production env var. Deployed from the repo root
  (`vercel --prod` must run from the monorepo root, not `apps/web` —
  the project's Root Directory setting expects the full monorepo
  uploaded and applies `cd apps/web` itself; running from inside
  `apps/web` uploads only that subtree and fails with a confusing
  "Root Directory apps/web does not exist" error, since Vercel then
  looks for a nonexistent nested `apps/web` inside what's already
  `apps/web`'s own content — worth remembering for the next manual
  deploy).
- **Live-verified, not just deployed**: `/api/health` →
  `{"status":"ok","database":"reachable"}`; `/login`, `/integrations`
  return real 200s; a live screenshot of
  `https://signal-desk-web-eta.vercel.app/integrations/slack` shows the
  honest "temporarily unavailable" customer-safe copy (Iteration 20)
  with no dev-setup leak and no stale "Foundation preview" badge
  (Iteration 21/23) — the exact fix this session's Customer POV audit
  was built around, confirmed on the real public URL, not just a local
  `next start` simulation.
- **Still real gaps, not resolved by this**: (1) this deployment came
  from the local working tree via the CLI, not a Git push — the
  project has **no GitHub connection configured** (checked directly:
  `vercel project inspect` shows no linked repo), so nothing
  auto-deploys on push; every future deploy needs the same manual
  `vercel --prod` from the repo root until that's wired up. (2) None of
  today's Customer POV audit fixes (Iterations 20-28) are committed to
  Git yet, even though they're now live in production — production is
  currently ahead of `git log`, a real, if temporary, state worth
  closing by committing this work. (3) Every other still-open item
  below (error-monitoring vendor, real OAuth app credentials, live-mode
  Stripe) is unaffected by this and remains real.
- **Re-checked 2026-08-23, precisely rather than assumed still
  accurate**: worth re-verifying rather than trusting a two-day-old
  claim, given how much more work has happened since. `git show
02f162d:SELF-HEALING-AUDIT.md` (the one real commit that exists on
  `main` after this document's own snapshot date) confirms it captured
  work only through Iteration 19 — meaning the "not yet committed" gap
  above was, if anything, understated even when written (Iterations 1-19
  weren't committed at the time either), and has grown substantially
  since: this working tree now also carries every fix through Iteration
  52, none of it committed, none of it redeployed since Iteration 29's
  original `vercel --prod`. The honest current picture is a real
  three-way divergence, not the original two-way "production ahead of
  git log" framing: **production** reflects Iteration 29's deploy state,
  **`git log`** reflects Iteration 19 (via `02f162d`), and this **local
  working tree** carries everything through Iteration 52 committed to
  neither. Resolving this is still the same real action either way —
  committing (and, separately, a fresh deploy) — this addendum only
  corrects the scope, not the nature, of what's outstanding.

### 5. Stripe billing not reconciled against a real live-mode account

- **Subsystem**: `packages/persistence`'s `plans`/`plan_prices`/
  `plan_entitlements`/`plan_addons` seed data; `apps/web/app/_lib/
stripe-billing-config.ts`.
- **Owner action**: confirm the seeded plan/price data matches real,
  live-mode Stripe product/price IDs (today's seed data was deliberately
  left untouched this pass per explicit instruction — it has not been
  independently confirmed against a live Stripe account); set
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to live-mode values; register the
  production webhook endpoint in the Stripe dashboard.
- **Shortest path**: a real test-mode-to-live-mode checkout dry run
  before flipping any real customer's card at risk.

## P1 — needed for a trustworthy, complete launch

### 6. Terms of Service, Privacy Policy, Support contact are placeholders

- **Subsystem**: `/legal/terms`, `/legal/privacy`, `/support` (added this
  pass as honest, clearly-labeled drafting checklists, not real legal
  text or a working support channel).
- **Owner + counsel action**: real legal review and a real support
  channel decision (monitored inbox, or adopting a ticketing tool).
- **Shortest path**: hand `docs/launch-readiness.md`'s LEGAL_TRUST_SUPPORT
  section and the placeholder pages' own drafting checklists to counsel.

### 7. No database-migration rollback discipline documented as an enforced practice

- **Subsystem**: `packages/persistence/drizzle/`.
- **Owner decision to adopt**: writing migrations additively (already the
  de facto practice this whole session) needs to become a stated,
  enforced review rule, not an implicit habit — a process decision, not
  a build task.

### 8. Password-reset AND real signup confirmation email delivery unverified end to end — now with live evidence the dev project is hitting Supabase's own default sender's rate limit

- **Subsystem**: `requestPasswordResetAction`/`signUpAction`
  (`_actions/auth.ts`), the Supabase project's own email/SMTP
  configuration — both send through the same Supabase Auth email
  transport, so this is one underlying gap, not two.
- **New evidence (2026-08-23, Customer POV audit continuation)**: drove
  the real `/signup` form live with Playwright against a real,
  never-before-used email address (`@mailinator.com`, a real
  deliverable domain — `example.com` was separately rejected outright
  as invalid, presumably a Supabase-side blocklisted/documentation
  domain, not a bug in this app). The very first live submission
  returned `error: "email rate limit exceeded"` — Supabase Auth's own
  message, relayed verbatim by `signUpAction`'s existing
  `{ error: error.message }` (already judged customer-appropriate
  elsewhere this session, since Supabase's own Auth error strings are
  designed to be end-user-safe). Hitting this limit on essentially the
  first real attempt is strong, direct evidence — not an inference from
  reading code — that this **dev** project is currently sending through
  Supabase's own built-in sender (publicly documented as ~2-4
  emails/hour, explicitly not meant for production volume) rather than
  a configured custom SMTP provider. Confirms and sharpens what was
  previously only a documented uncertainty ("hasn't been separately
  confirmed") into a live-observed fact for the dev project
  specifically.
- **Still not confirmed**: whether the separate **production** Supabase
  project (`business-dashboard-production`) has custom SMTP configured
  — dev and production are independent Supabase projects with
  independent email settings, and this session's live test only
  exercised dev. This app already has a real, working custom email
  client (`packages/integrations/src/resend/client.ts`, used for team
  invites and Daily Brief emails) — the same Resend account could
  plausibly be wired in as Supabase Auth's custom SMTP provider too,
  but doing so is a Supabase Dashboard (Authentication → Emails → SMTP
  Settings) configuration change requiring real SMTP credentials, not
  something achievable through this repository's code or the MCP tools
  available this session — a genuine owner action, not a build task.
- **Owner action**: in the Supabase Dashboard for the **production**
  project specifically, confirm whether a custom SMTP provider is
  configured for Auth emails; if not, configure one (Resend, which this
  app already uses elsewhere, is a reasonable default) before real
  signup or password-reset traffic can be expected to work reliably
  past a handful of users per hour.
- **Why P1, not P0**: the flow itself (request → generic response →
  callback → confirm page → honest invalid-link state; and for signup,
  form → validation → honest error display) is built and live-verified
  end to end — only the actual email transport leg's production
  configuration is unconfirmed.

## P2 — real gaps, safe to launch without

### 9. Role-aware UI

Roles (owner/admin/member/viewer) gate actions correctly today but don't
yet change what's rendered — disclosed as narrow-by-design scope from
Phase 3, not a regression.

### 10. Six connectors support only full re-sync, not true incremental sync

Slack, Stripe (Connect), Google Calendar, Microsoft Outlook, Microsoft
Calendar, Linear — "Sync Now" still works correctly for each; this is an
efficiency gap at scale, not a correctness gap at launch.

### 11. Structured application logging — partially closed 2026-08-24 (ADR 0061)

Distinct from error monitoring (P0 #3). Investigating found Server
Actions already had real structured error reporting (`errorReporter` via
`describeActionError`) — the real gap was narrower: three Route Handlers
with no Server Action to route through (the Stripe webhook, the
QuickBooks webhook, the billing-reconciliation cron) called raw
`console.*` directly, with their real exceptions never reaching error
monitoring at all. A new `Logger` interface
(`packages/application/src/observability/logger.ts`, same seam pattern
as `ErrorReporter`) now covers structured info/warn logging for those
three, and their genuine caught exceptions now route through the
existing `errorReporter` too. Still real, still P2, not closed
completely: ~36 other files (OAuth callbacks, disconnect actions, sync
functions) still use raw `console.*` — lower operational value than the
three fixed, since most already fail closed to a safe user-facing
outcome regardless — see ADR 0061's own scope section.

### 12. OAuth-based invite acceptance

Currently moot — `NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS` is empty in every
environment today, so no real user hits this gap yet. Re-open as P1 the
day a social provider is actually configured (see P0 #1's connector work,
a related but distinct credential).
