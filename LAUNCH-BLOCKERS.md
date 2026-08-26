# Launch blockers

- **Update (2026-08-26, third pass)**: Two further, real actions this
  pass, both against the live dev Supabase project, both requested and
  confirmed by the owner first. First: the 32,183 accumulated test
  organizations named in the pass below were real and disposable —
  verified every single one matched the exact synthetic slug pattern
  (`org-<hex>`) `seedOrganization`/guest-provisioning generate (zero
  exceptions on a direct check), confirmed production is unaffected
  (separate project, checked directly, 0 organizations), then cleared
  them: `audit_events` has a RESTRICT foreign key to `organizations` by
  design (append-only), so it was cleared first, then `organizations`
  itself, letting the existing `ON DELETE CASCADE` chain clean up every
  dependent table. Second: the same systematic grant-vs-policy
  cross-check that found the `tasks` bug below was re-run against every
  table, surfacing the identical latent shape on five more —
  `app_runtime` held `UPDATE` grants (and, for `users`, `INSERT` too) on
  `leads`/`messages`/`source_records`/`support_tickets`/`users` with no
  matching RLS policy anywhere, dead and unused (confirmed: no code
  issues any of these statements; the real, already-working
  anonymize-on-delete flow updates these same tables through a
  different, RLS-bypassing role, `organization_data_steward`, so it
  never depended on this). Rather than add speculative policies for
  operations that don't exist, revoked the unused grants instead
  (`0068_revoke_unused_app_runtime_write_grants.sql`, applied to both
  dev and production) — this doesn't remove any real capability, it
  closes the exact footgun that already caused the `tasks` bug once.
  One existing test asserted the old, weaker "RLS silently drops the row"
  behavior for `source_records`; updated to assert the new, stronger
  "permission denied" failure instead (matching `audit_events`'s own
  already-established pattern) — 571/571 persistence tests green after.
- **Update (2026-08-26, continued)**: A full `pnpm check` re-run against
  the real dev database surfaced one genuine, previously-undetected
  data-integrity bug — now found, fixed, and verified, not just
  documented. `markTaskCompletedBySourceRecord` (`tasks.ts`, the Jira
  closed-issue second sync pass) has been issuing real
  `update tasks set completed = true where ...` statements since it was
  added, but `public.tasks` was missing its `tasks_tenant_update` RLS
  policy — present on `invoices` (fixed once already, migration 0036) but
  never added here, since nothing updated a task at the time `tasks` was
  created (migration 0030). With RLS forced and no permissive UPDATE
  policy, every one of those statements has always silently matched zero
  rows: a Jira issue closing has never actually marked its task complete
  in this database, dev or production, despite everything else in that
  sync path being real, tested, and live-verified. Reproduced
  deterministically against a fresh org/task on the real dev database,
  confirmed via `pg_policy` that `tasks` carried only `{insert, select}`
  policies (no `update`), fixed with a new additive migration
  (`0067_tasks_tenant_update_policy.sql`, mirroring `invoices_tenant_update`
  exactly), applied to both the real dev and production Supabase
  projects via `apply_migration`, and confirmed fixed by re-running the
  previously-failing test (now green, 15/15 in `tasks.test.ts`). A
  second, unrelated test failure in the same run
  (`scheduled-jobs.test.ts`, `listOrganizationsNeedingDailyBrief`'s
  fair-rotation ordering tests) turned out to be pure test fragility, not
  a product bug: the dev database has accumulated 32,183 organizations
  across many sessions' worth of live-database test runs with nothing
  ever cleaning them up, so the tests' hardcoded `max=1000` cap excluded
  their own freshly-seeded organizations before the ordering assertion
  ever got a chance to run (production, checked the same way, has 0 —
  this never touches real customer risk). Fixed by sizing the cap from
  the real current active-organization count instead of a fixed guess;
  the dev database's own test-data accumulation is a real, disclosed,
  separate hygiene item — not fixed here, since bulk-deleting 32k rows
  from a live Supabase project is the kind of action worth the owner's
  own sign-off rather than an autonomous call. Separately, P0 #3's
  "solvable autonomously by Claude" half is now actually done: see its
  entry below.
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
  (the real, provider-neutral `ErrorReporter` interface — mirrors the
  exact `AIProvider` seam pattern) — routed through
  `describe-action-error.ts`, the one shared helper nearly every Server
  Action's catch block already calls, so every one of those already
  reports through this seam.
- **Resolved this pass**: the engineering half of this item —
  `createSentryErrorReporter`
  (`packages/application/src/observability/sentry-error-reporter.ts`, 3
  unit tests) is a real, working `@sentry/node`-backed adapter.
  `apps/web/app/_lib/error-reporter.ts` now resolves to it automatically
  whenever `SENTRY_DSN` is set, following the exact "unset credential ⇒
  feature inert" convention `agent-config.ts` already established for
  `ANTHROPIC_API_KEY` — with it unset (true in every environment today),
  the console-based reporter stays the default, zero behavior change.
- **Owner action, the only piece left**: pick a vendor (the adapter above
  already targets Sentry, the path of least friction for this exact
  stack), create a project, get a DSN, set `SENTRY_DSN` as a production
  env var. No further code change needed.
- **Why still P0**: until a real DSN is set, production errors still
  only surface as Vercel's own function logs — the seam and the adapter
  existing doesn't yet mean anyone is notified of a real incident.

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

### 6. Production database has zero backup/disaster-recovery coverage — new finding, 2026-08-26

- **Subsystem**: the Supabase organization (`qqmwladucvpnwwztvdgk`) that owns
  both the dev (`wbrcifdvzkwxpgzxfegc`) and **production**
  (`qkmiafzljcsaihcnywqj`) projects.
- **How this was found**: attempting a real backup/restore drill (branching
  the dev project to prove restore works without touching real data).
  `create_branch` failed with `PaymentRequiredException: Branching is
supported only on the Pro plan or above` — this organization is on
  Supabase's Free plan. Free-tier projects have no point-in-time recovery
  and no automated backups at all, for either project.
- **Why P0, not P2**: this is not "no drill has been run yet" — it's that
  production has no recovery path of any kind for real customer data today.
  A bad migration, a bug, or a compromised credential could destroy data
  permanently with nothing to restore from. This sits squarely inside
  CLAUDE.md's own top-priority concern (data integrity), independent of
  every credential-gated item above.
- **Owner action**: upgrade the Supabase organization to at least the Pro
  plan (Supabase's own pricing, not this app — roughly $25/mo base at time
  of writing) — a real spend decision only the account owner can authorize.
- **Shortest path**: upgrade the plan, confirm PITR/scheduled backups are
  enabled for the production project specifically, then run the
  branch-based restore drill this pass attempted (safe, non-destructive,
  ~$0.01344/hour while the branch exists) to prove it for real rather than
  trusting the dashboard toggle alone.

## P1 — needed for a trustworthy, complete launch

### 6. Terms of Service, Privacy Policy, Support contact are placeholders

- **Subsystem**: `/legal/terms`, `/legal/privacy`, `/support` (added this
  pass as honest, clearly-labeled drafting checklists, not real legal
  text or a working support channel).
- **Owner + counsel action**: real legal review and a real support
  channel decision (monitored inbox, or adopting a ticketing tool).
- **Shortest path**: hand `docs/launch-readiness.md`'s LEGAL_TRUST_SUPPORT
  section and the placeholder pages' own drafting checklists to counsel.

### 7. ~~No database-migration rollback discipline documented as an enforced practice~~ — RESOLVED 2026-08-24

- **Subsystem**: `packages/persistence/drizzle/`, `CLAUDE.md`.
- **What actually happened**: writing migrations additively was already
  this repo's de facto practice since its earliest migration (`0000`) —
  what was missing was only the stated rule. Added to `CLAUDE.md`'s
  Process section: prefer adding over dropping/renaming in place; a
  genuine rename/removal lands as separate migrations (add + backfill
  first, remove only once nothing reads the old shape), never one step
  that could silently drop or truncate real tenant data. Now a rule to
  enforce in review, not an implicit pattern to infer from precedent.

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

### 9. ~~Role-aware UI~~ — the two real gaps closed 2026-08-24 (ADR 0062)

`/profile` already rendered role-aware (`canManageTeam`/`canEdit` hide or
disable controls, not just gate server-side) — that part of this entry
was already inaccurate. Investigating found the two real, unguarded
surfaces: connector connect/disconnect (already flagged by the
certification's adversarial pass, left for a deliberate decision) and
`/billing` (a new finding — no role check on any billing-mutating
action). Confirmed with the user and closed both: 30 Server Actions
(28 connector connect/disconnect + 7 billing) now check
`role === "owner" || role === "admin"`, matching `/profile`'s existing
pattern; both pages' UI shows an honest read-only state for a
`member`/`viewer` instead of controls that would just fail server-side.
Sync ("Sync Now") deliberately stays ungated — a lower-stakes, read-only
refresh, not what was asked about. See ADR 0062 for the full account.

### 10. Six connectors have no content sync at all yet — corrected 2026-08-24, this entry previously overstated what exists

Slack, Stripe (Connect), Google Calendar, Microsoft Outlook, Microsoft
Calendar, Linear. Checked directly against the catalog
(`packages/integrations/src/index.ts`) rather than assumed from this
entry's own prior wording: all six honestly declare
`syncImplemented: false, initialSyncImplemented: false,
incrementalSyncImplemented: false` — there is no `sync-*.ts` file, no
"Sync Now" button, and no canonical-entity mapping for any of them.
These are OAuth-connection-only integrations today (real token storage,
real revoke), not "full-resync-only" ones — the previous wording here
was inaccurate, not just imprecise. Building real sync for any one of
them is a materially bigger scope than "add an incremental cursor to an
existing sync" — each needs its own mapper, a canonical entity target
(does a Linear task become a `tasks` row the way Asana's does? does a
calendar event get its own new canonical entity?), and, to be visible on
the One Page at all, a real Intelligence Core capability reading that
new data — closer in size to one ADR-0057-style build per connector
than a quick fix. Still `P2`/safe to launch without (none of the Golden
Path's six workflows in `SIGNALDESK_SYSTEM_CERTIFICATION.md` depend on
any of these six connectors syncing content), but real scoping/product
decisions are needed before building any one of them, not just
engineering time.

### 11. ~~Structured application logging~~ — RESOLVED 2026-08-24 (ADR 0061)

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
existing `errorReporter` too. A same-day follow-up pass then extended
both seams to all 36 remaining raw `console.*` call sites (14 OAuth
callbacks, 11 disconnect actions, `delete-organization.ts`,
`start-checkout.ts`, 8 sync functions, plus
`billing/payment-method/return/route.ts`, found mid-sweep). The only two
raw `console.*` call sites left in the app — `error.tsx` (browser-side,
a different unbuilt seam) and `packages/intelligence/src/registry.ts`
(would require a new cross-package dependency for one line) — are
deliberate, documented exclusions, not oversights. See ADR 0061's
"Follow-up" section for the full account.

### 12. OAuth-based invite acceptance

Currently moot — `NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS` is empty in every
environment today, so no real user hits this gap yet. Re-open as P1 the
day a social provider is actually configured (see P0 #1's connector work,
a related but distinct credential).
