# Launch blockers

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

### 4. Vercel project not yet created / configured

- **Subsystem**: deployment, see `docs/deployment-runbook.md`.
- **Owner action**: create the Vercel project, set Root Directory to
  `apps/web`, enter every production env var, connect the Git repo.
- **Shortest path**: literally follow `docs/deployment-runbook.md`'s
  "One-time project setup" section top to bottom.

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

### 8. Password-reset email delivery unverified end to end

- **Subsystem**: `requestPasswordResetAction` (`_actions/auth.ts`), the
  Supabase project's own email/SMTP configuration.
- **Owner action**: confirm Supabase's project-level email settings
  (default Supabase email sending is rate-limited and not meant for real
  production volume — a real custom SMTP provider is the standard
  recommended step) actually deliver a working recovery email; this
  environment has no real inbox to test against.
- **Why P1, not P0**: the flow itself (request → generic response →
  callback → confirm page → honest invalid-link state) is built and
  live-verified end to end this pass — only the actual email transport
  leg is unconfirmed, and defaults to Supabase's own built-in sender
  until a custom one is configured.

## P2 — real gaps, safe to launch without

### 9. Role-aware UI

Roles (owner/admin/member/viewer) gate actions correctly today but don't
yet change what's rendered — disclosed as narrow-by-design scope from
Phase 3, not a regression.

### 10. Six connectors support only full re-sync, not true incremental sync

Slack, Stripe (Connect), Google Calendar, Microsoft Outlook, Microsoft
Calendar, Linear — "Sync Now" still works correctly for each; this is an
efficiency gap at scale, not a correctness gap at launch.

### 11. Structured application logging

Distinct from error monitoring (P0 #3) — a unified structured logger
across Server Actions/Route Handlers doesn't exist. Real, but Vercel's
own function logs plus the P0 APM fix cover the immediate operational
need.

### 12. OAuth-based invite acceptance

Currently moot — `NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS` is empty in every
environment today, so no real user hits this gap yet. Re-open as P1 the
day a social provider is actually configured (see P0 #1's connector work,
a related but distinct credential).
