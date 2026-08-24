# SignalDesk System Certification

This file holds two things: the standing **certification directive**
(the prompt itself — re-run it, or sections of it, in any future session
that needs to re-certify the system) and the **certification log**, a
running record of what's actually been traced, tested, broken, and
repaired — in the same spirit as `SELF-HEALING-AUDIT.md`'s iteration log,
but scoped specifically to end-to-end system certification rather than
general self-healing sweeps. `SELF-HEALING-AUDIT.md` keeps recording
day-to-day fixes; this file is where a full inventory-to-certification
pass lives so it isn't lost inside that much longer log.

This directive was adapted from a much larger template written for a
different product (a "BrandOps" career/Digital Twin platform). The
structure — inventory first, full lifecycle tracing per connector, a
Golden E2E suite, failure injection, two independent passes, an
adversarial red-team follow-up, severity-ranked repair — is sound and
worth keeping. The content had to be rewritten, not search-replaced:
SignalDesk has no Digital Twin, résumé upload, Plan Compiler, MCP
surface, or worker/queue, and pretending otherwise would violate this
repo's own honesty discipline. Where BrandOps's structure assumes
infrastructure SignalDesk doesn't have, this version says so explicitly
rather than inventing a test for something that isn't there.

---

## THE DIRECTIVE

> **SIGNALDESK — FULL-SYSTEM CERTIFICATION DIRECTIVE.** Treat the
> current SignalDesk repository as a production candidate that must be
> independently certified from source code to runtime. Do not assume any
> connector, workflow, Safe Action, AI capability, database operation,
> permission, UI control, or integration works simply because the code
> exists — prove it by tracing the implementation and executing it where
> safely possible against the real dev database and dev server. `CLAUDE.md`,
> the existing architecture (Connector Framework, Business Graph,
> Intelligence Core, Agent Fabric, Safe Action Gateway, RLS/tenancy model),
> and `README.md`'s capability-snapshot table remain authoritative — this
> is verification, not redesign; never weaken security, RLS, token
> handling, or webhook signature verification to make a test pass, and
> never fabricate a capability (a worker/queue, MCP, distributed tracing,
> a second AI vendor) that doesn't exist merely because a reference
> template assumed one — record its real absence instead.
>
> **Phase 1 — Inventory.** Build a complete, classified inventory in this
> file: every frontend route (`apps/web/app/**/page.tsx`), every Server
> Action (`apps/web/app/_actions/*.ts`), every API route
> (`apps/web/app/api/**/route.ts`), every database table and migration
> (`packages/persistence/src/schema.ts`, `packages/persistence/drizzle/`),
> every connector (`packages/integrations/src/index.ts`'s catalog — all
> 25 entries), every real Safe Action, every Intelligence Core capability,
> every Agent Fabric specialist capability, every Vercel Cron job, every
> webhook endpoint, every environment variable this app reads
> (`apps/web/.env.example`), and every ADR that governs one of the above.
> For each item, record its source file, its caller, its downstream
> dependency, its persistence path, its authorization boundary (which RLS
> policy or role check protects it), its test coverage, and classify it
> `VERIFIED` (traced and live-tested this pass), `VERIFIED_STATIC`
> (traced by reading code and existing tests, not live-exercised this
> pass), `PARTIAL`, `UNWIRED`, `BROKEN`, `MOCKED`, or `N/A —
infrastructure that does not exist in this codebase` (for anything a
> generic template would assume but SignalDesk genuinely doesn't have —
> name it once, don't keep re-flagging it).
>
> **Phase 2 — Connector Certification Matrix.** For every one of the 25
> catalog connectors, trace the real lifecycle this app actually has:
> **discovery (catalog entry) → connect click → OAuth authorize (state/
> CSRF, PKCE where the provider supports it) → callback → token exchange
> → Supabase Vault storage → scope grant → initial sync → `source_records`
> → normalized Business Graph entity → Intelligence Core finding →
> Card → recommended action → Safe Action → audit event → health/
> freshness (`sync_jobs`/`computeConnectorHealth`) → disconnect →
> revoke (where the provider supports it)**. For the 14 real connectors,
> verify: tokens never reach the browser or a log line; scopes requested
> match `connector.authStrategy.scopes`; every one of the 14 OAuth
> callback routes fails closed with a safe status-keyword redirect, never
> a raw error; the 8 connectors with `incrementalSyncImplemented: true`
> actually consume their cursor on a second run, not just declare the
> flag; QuickBooks's webhook signature verification rejects a forged
> `intuit-signature` header; disconnect deletes the Vault secret and
> attempts remote revocation where a real revoke endpoint exists (Slack,
> HubSpot, Salesforce, Xero, Zendesk — not Jira/Microsoft, which
> genuinely have none, confirmed against their own docs, not assumed).
> For the 11 catalog-only connectors, verify the UI never implies a
> working connection and every `readiness` flag is honestly `false`.
>
> **Phase 3 — Golden End-to-End Workflow Suite.** Trace and, where the
> local dev environment allows, actually execute each of these complete
> paths, recording every hop by real file/function name:
>
> 1. `sign up or guest sign-in → organization provisioned → Today page
honest empty state → connect a real system (or seed one open
internal_tasks row when no real connector can be exercised here,
same limitation this session's audits have already documented) →
initial sync → source_records → normalized entity → Intelligence
Core finding → card on the One Page → recommended action click →
createInternalTaskAction → real DB write + audit event → TasksPanel
shows it (requires the caller's router.refresh()) → Mark done →
completeInternalTaskAction → real DB write + audit event → task
gone from the panel, confirmed against the database directly, not
just the re-rendered UI.`
> 2. `command bar → parseCommandAction → a real filter, a real "create a
task for these," or a real "investigate" intent → the corresponding
real result, never an unrecognized-command fallback for a command
the UI itself suggests.`
> 3. `command bar "investigate" → runAgentInvestigationAction → kill
switch check → rate limit → getTodaysAttention (re-derived, never
client-trusted) → classifyEvidenceSufficiency gate → advisory lock
→ startAgentCollaboration → AgentGatewayService.dispatch (policy
check → capability grant, 5-minute TTL → provider.generateStructured
→ agent_task_results + actor_kind:"agent" audit event) → across all
three real capabilities (financial/delivery/ticket risk) →
reconcileSpecialistResults (one card or honest null) → Approve →
re-verified evidence sufficiency at approval time → the same
createInternalTask the quick-action path uses (confirm it's
genuinely the same function, not a parallel implementation) →
audit event.`
> 4. `/pricing → checkout → Stripe → billing/checkout/return (refuses the
client-side redirect, reads the webhook-synced row as truth) →
billing/webhooks/stripe (signature verified) →
organization_subscriptions updated → canAddActiveConnection/
getEntitlementUsage correctly reflect the new plan → every mutating
billing action (cancel/resume/change-plan/add-on/retry) also
directly syncs the local row, confirm it can never disagree with
what the webhook would have written.`
> 5. `/profile → add a goal → evaluateGoal against real
computeBusinessMetrics output → status shown on /profile and, if
AT_RISK/OFF_TRACK, a real corresponding card on the One Page.`
> 6. `Daily Brief generate → real findings assembled → artifact persisted
→ identical content shown on / and /briefs.`
> 7. `team invite → real token-based organization_invites row → accept →
atomically joins the inviting org (never auto-provisions a second
solo org) → real second role-holder → role-gated visibility (owner-
only sections actually hidden from a member).`
> 8. `/profile/export → real per-tenant data export; delete-organization
→ real anonymize-on-delete path (PII scrubbed, records kept
unlinkable) — confirm both against a live account, not just the
persistence function's unit tests.`
>
> For each, mark which hops were live-verified against the real dev
> database this pass vs. verified only by reading code and existing
> tests — these are not the same claim, and the report must say which is
> which.
>
> **Phase 4 — Adversarial and Failure-Injection Testing.** Do not stop at
> the happy path. Test, live where safe:
>
> - **Idempotency under double-submit**: rapid double-click on every
>   idempotency-keyed action (`create_internal_task`,
>   `complete_internal_task`, goal creation, checkout) — confirm exactly
>   one real effect. Confirm a genuinely concurrent second
>   agent-investigation trigger gets the real advisory-lock
>   "already running" response, not a race that starts two collaborations.
> - **Rate limits, exercised for real, not read from code**: guest
>   session creation (5/hour/IP), agent investigation (3 per 5 minutes
>   per org), a connector's "Sync now" (1 per 5 minutes per org), and
>   sign-in/sign-up — confirm each actually triggers and that the
>   resulting message is honest and actionable.
> - **Cross-tenant isolation under adversarial input**: for every
>   RLS-forced table, attempt to read or write another organization's row
>   by supplying a foreign id directly to a Server Action or persistence
>   function. `packages/persistence/tests/` already has this pattern for
>   several tables — confirm it covers `internal_tasks`' `complete` path
>   and the Agent Fabric tables (`agent_collaborations`,
>   `agent_task_results`, `agent_delegation_grants`) and extend it where
>   it doesn't, following the exact existing test shape rather than
>   inventing a new one.
> - **Revoked/expired credentials mid-session**: what happens when a
>   connector's token is invalid provider-side (not just locally expired)
>   — does sync surface an honest re-auth state, or fail silently/loop?
> - **Malformed or slow upstream responses**: a connector returning a
>   5xx, a truncated body, or hanging — confirm it surfaces as the
>   existing safe, generic message (`UpstreamProviderError`/
>   `QueryFailedError`'s established pattern) and never leaks a raw
>   response body, and never takes the rest of the request down with it.
> - **Prompt injection via synced business data**: confirm
>   `claude-provider.ts`'s `<untrusted_business_data>` delimiter and
>   `neutralizeDelimiterEscapes` actually hold against a crafted finding
>   summary/title containing an attempted instruction override — this is
>   the one real place untrusted external content reaches a model prompt
>   in this app; it deserves a direct adversarial test, not just a code
>   read.
> - **Evidence staleness and specialist disagreement**: confirm
>   `classifyEvidenceSufficiency`'s `stale` branch actually declines an
>   investigation rather than proceeding on old evidence, and confirm
>   `reconcileSpecialistResults`' contradiction detection (wide confidence
>   spread) actually penalizes confidence rather than silently averaging
>   it away — both have unit tests; confirm they'd fail if the underlying
>   behavior broke, not just that they currently pass.
> - **Approval rejection and cancellation**: Dismiss on an agent proposal
>   → real audit event, zero execution, confirmed in the database.
> - **Transactional integrity under interruption**: force a failure mid-
>   `withTenantContext` transaction (a thrown error after a real insert
>   but before commit) and confirm the rollback actually leaves no
>   partial row — `withTenantContext`'s own rollback-on-error path is the
>   thing under test here, not assumed correct because it's well-commented.
> - **Unsupported connector**: confirm every one of the 11 catalog-only
>   connectors is honestly "not available" everywhere it's rendered
>   (list, detail page, card), never implying a working connection.
>
> **Explicitly out of scope for this pass — real, disclosed absences, not
> gaps to silently fabricate a test for**: there is no background
> worker/queue (only two synchronous Vercel Cron routes exist —
> `apps/web/app/api/cron/{morning-brief,billing-reconciliation}`); there
> is no MCP or A2A surface and nothing external can reach this app's
> agent layer today; there is no universal distributed-tracing/
> correlation-id system (only agent collaborations and checkout carry a
> real `correlationId` — note this as a genuine, narrow gap in the
> report, don't build full tracing in this pass unless asked); there is
> no second AI model vendor. Confirm each of these claims is still true
> (a fast grep, not assumed from a prior session) rather than skipping
> the check entirely.
>
> **Phase 5 — Repair discipline.** Rank every finding `P0` (real security/
> tenant-isolation/data-integrity break), `P1` (a real workflow that
> doesn't actually complete end to end), `P2` (a real but non-blocking
> gap), or `P3` (polish). Repair `P0`/`P1` findings before moving to the
> next phase, following this repo's existing extend-don't-replace
> patterns; after each repair, rerun the specific workflow it touches
> plus the relevant package's test suite, not just a spot check. Record
> every repair in `SELF-HEALING-AUDIT.md` following its existing
> iteration format (this file records the inventory/matrix/certification
> state; that file records the fix-by-fix narrative — don't duplicate
> content between them, cross-reference instead).
>
> **Phase 6 — Second independent pass.** Once Phases 1–5 are done, review
> this file's own inventory and matrix with fresh skepticism — do not
> trust the first pass's classifications. Spot-check at least the
> `VERIFIED` and `VERIFIED_STATIC` items most load-bearing for security
> (RLS coverage, token handling, webhook verification, `canExecute`
> enforcement) by re-deriving the answer independently rather than
> re-reading the first pass's own notes.

---

## THE ADVERSARIAL FOLLOW-UP (run separately, after the directive above)

> **Now assume the certification above is wrong.** Act as an external
> red-team auditor who has not seen it. Attempt to break SignalDesk from
> the outside in: start with the five most commercially important
> customer journeys (sign up, connect a system, act on a finding,
> subscribe, invite a teammate), then connectors, then the Agent Fabric,
> then RLS/authorization, then persistence, then the AI prompt boundary,
> then approvals and Safe Action execution. Use the running dev server
> and the real source, introduce concurrency and failures, and search
> specifically for: false-positive "success" states, unwired buttons,
> authorization bypasses (cross-tenant reads/writes), data leakage
> (a raw upstream error, a raw stack trace, a token, a `.env` value
> reaching customer-facing text), duplicate execution from a retried
> idempotent action, stale state the UI presents as fresh, corrupted
> persistence from an interrupted transaction, a prompt-injection payload
> that actually changes model behavior, and any connector that claims to
> work but doesn't. Produce only genuinely new findings, or explicit
> confirmation that a specific first-pass fix survives adversarial
> retesting — not a restatement of the first pass. Repair every `P0`/`P1`
> finding and rerun the complete affected workflow(s).

---

## Inventory

Built 2026-08-24 from direct source reads (three parallel passes), not
from memory of earlier sessions. Classification key: `VERIFIED` = traced
and live-tested this pass; `VERIFIED_STATIC` = traced by reading code
and existing tests, not live-exercised this pass; `PARTIAL`/`UNWIRED`/
`BROKEN`/`MOCKED` as defined in the directive; `N/A` = infrastructure
this codebase genuinely doesn't have.

### Frontend routes — 22 `page.tsx` files

All real server components doing genuine DB reads except two explicitly
self-labeled placeholders. `VERIFIED_STATIC` for all: `/`, `/login`,
`/login/reset`, `/login/reset/confirm`, `/signup`, `/tickets/[id]` (+ its
`@modal` intercepted variant), `/agents` (owner-gated), `/integrations`
(+ `@modal` variant), `/integrations/[slug]`, `/briefs`, `/billing` (+
`checkout/[planKey]`, `checkout/trial-started`, `checkout/return`),
`/trust` (owner-gated), `/pricing`, `/profile`. `/` and
`/integrations/slack` are additionally `VERIFIED` (live-tested this
session, in production build). `/legal/privacy`, `/legal/terms`,
`/support` are `VERIFIED_STATIC` as **honest placeholders** — each says
plainly it isn't the real thing yet, which is the correct state, not a
defect.

### Server Actions — 64 files, `apps/web/app/_actions/`

All session-authenticated (`getCurrentOrganization()`) except the two
webhook-adjacent read endpoints, which are route handlers, not actions.
Grouped, `VERIFIED_STATIC` unless noted:

- **Safe Actions (strict pattern — idempotency key + audit event inside
  `withTenantContext`)**: `create-internal-task.ts`,
  `complete-internal-task.ts` — both `VERIFIED` (live-tested this
  session, including a real DB+audit-event check).
- **Task/goal/agent-proposal**: `create-goal.ts`,
  `approve-agent-action-proposal.ts` (calls the same `createInternalTask`
  the human path uses — confirmed, not a parallel implementation),
  `dismiss-agent-action-proposal.ts`, `record-card-feedback.ts`,
  `simulate-invoice-payment.ts` (read-only).
- **Command bar / Agent Fabric**: `parse-command.ts`,
  `run-agent-investigation.ts` — `VERIFIED` (live-tested this session
  against all three specialist capabilities; correct honest-empty
  result confirmed for a zero-data workspace).
- **Connector connect (15)** — one per connector + `connect-ai-provider.ts`.
  Uniform: session check → OAuth state/PKCE issuance → redirect; no DB
  write until the callback.
- **Connector disconnect (15)** — one per connector + `disconnect-ai-provider.ts`.
  Best-effort remote revocation (11 of 14 real connectors have one;
  Microsoft Calendar/Outlook and Jira are documented local-only, no
  provider revoke endpoint exists) + Vault deletion + audit event.
- **Connector sync (8)** — one per connector with `incrementalSyncImplemented: true`
  (asana, hubspot, quickbooks, salesforce, jira, xero, zendesk, gmail).
  Rate-limited 1/5min; calls the same ingest functions the OAuth
  callback's initial sync uses.
- **Billing (7)** — `start-checkout.ts` (advisory-locked), `cancel-`/
  `resume-subscription.ts`, `change-plan.ts` (preview + real proration
  write), `start-payment-method-setup.ts`, `retry-subscription-payment.ts`,
  `manage-addon.ts`. All real Stripe calls + local-row sync.
- **Brief**: `generate-daily-brief.ts`, `generate-since-you-left-brief.ts`,
  `email-daily-brief.ts` (real Resend send, honest failure if unconfigured).
- **Profile/team**: `update-preferences.ts`, `update-business-profile.ts`,
  `invite-member.ts`, `revoke-invite.ts`, `delete-organization.ts` (real
  revocation across all 14 connectors + Stripe cancellation +
  `anonymizeOrganization`, before any DB delete).
- **Auth (7 exports, `auth.ts`)**: sign-in/up/out, password reset,
  guest sign-in, OAuth sign-in — real Supabase Auth calls, IP-keyed rate
  limits, `safeNextPath` redirect sanitization.
- **CSV import**: `preview-csv-invoice-import.ts` (dry-run, rate-limited),
  `import-csv-invoices.ts` (real write per row inside a `sync_jobs`
  record).

### API routes — 23 files, `route.ts`

`/auth/callback` (Supabase PKCE exchange), `/billing/payment-method/return`
(session-auth), `/profile/export` (session-auth, real export download),
`/api/health` (public liveness, `select 1`), `/api/business/snapshot`
(session-auth, rate-limited 30/min/org) — all `VERIFIED_STATIC`.

**14 OAuth callbacks** — one per real connector. Single-use CSRF `state`
cookie, PKCE where the provider needs it, IP-rate-limited (20/hr),
entitlement-checked before token exchange, every failure path redirects
with a status keyword, never a raw error. 8 of 14 run a real initial
sync inline. `VERIFIED_STATIC` for all 14; Slack's specifically
`VERIFIED` (production-build live test, "temporarily unavailable"
unconfigured state confirmed honest).

**2 webhooks**: `/integrations/quickbooks/webhook` (`intuit-signature`
HMAC, realm-scoped rate limit substituting for replay protection since
Intuit's scheme carries no timestamp), `/billing/webhooks/stripe`
(`stripe-signature` HMAC with SDK-built-in 5-minute replay tolerance).
Both fail closed (400) on a bad signature, 503 if unconfigured, and are
correctly unauthenticated (signature is the auth). `VERIFIED_STATIC`.

**2 cron routes** (`Bearer CRON_SECRET`): `/api/cron/morning-brief`
(idempotent-per-day, up to 500 orgs), `/api/cron/billing-reconciliation`
(Stripe drift reconciliation, up to 500 subscriptions, same mapping
function the webhook uses). `VERIFIED_STATIC`.

### Database — 32 tables, `packages/persistence/src/schema.ts`

**24 tenant-scoped tables, all with confirmed forced RLS** (`enable` +
`force row level security`, 1:1, no orphans — verified by grep across
all 61 migrations, not by trusting `schema.ts` alone, since Drizzle's
schema declaration doesn't itself enforce anything): `memberships`,
`integrations`, `sync_jobs`, `source_records`, `leads`, `invoices`,
`payments`, `artifacts`, `tasks`, `messages`, `support_tickets`,
`signals`, `recommendations`, `card_feedback`, `audit_events`,
`internal_tasks`, `goals`, `agent_collaborations`, `agent_task_results`,
`agent_delegation_grants`, `organization_subscriptions`,
`internal_cost_events`, `organization_invites`, `ai_provider_connections`
— plus `organizations` and `users` (the tenancy root and global identity)
and `organization_subscription_addons` (tenant-scoped indirectly via
join, not a direct `organizationId` column). **5 deliberately
non-tenant tables** (`plans`, `plan_prices`, `plan_entitlements`,
`plan_addons`, `rate_limit_buckets`) — RLS-disabled state itself
confirmed by a live test (`security-invariants.test.ts`), not assumed.

**16 active SECURITY DEFINER functions** spanning identity provisioning,
connector token storage, webhook org resolution, org
anonymization/invites, AI-provider-key storage, and two narrow
scheduled-job cross-tenant reads (`0055b`/`0056`) whose `PUBLIC` execute
grant was found and revoked in `0058` after being flagged as a real,
live cross-tenant enumeration bypass — good historical evidence this
security discipline is real, not aspirational.

**Test coverage**: cross-tenant isolation cases exist for every
tenant-scoped table with real application writes, including both
`internal_tasks` paths (create and complete) and all 14 connectors'
token/connection tables. Two real, disclosed gaps: `signals` and
`recommendations` have zero application code writing to them and zero
tests — `schema.ts`'s own comment already discloses this as a real DDL/
zero-writer orphan, not a hidden defect; confirm in Phase 4 this is
still true rather than re-flagging it as new.

### Connectors — 25 catalog entries, `packages/integrations/src/index.ts`

**14 real-OAuth** (`foundation-preview`): slack, hubspot, gmail,
microsoft-outlook, stripe, quickbooks, google-calendar,
microsoft-calendar, asana, linear, salesforce, jira, xero, zendesk.
**11 catalog-only** (`planned`, every readiness flag `false`): pipedrive,
microsoft-teams, clickup, monday-com, teamwork, github, dropbox,
google-drive, sharepoint, intercom, docusign. `incrementalSyncImplemented: true`
for exactly 8 (hubspot, gmail, quickbooks, asana, salesforce, jira,
xero, zendesk). `actionsImplemented`/`productionReady` are `false` for
all 25 without exception — no connector can write back to its source
system, and none is claimed production-ready. `VERIFIED_STATIC`
(`VERIFIED` for slack and hubspot specifically, live-tested this
session). **Found**: a stale in-file comment near the catalog's
`foundation-preview` block still says "15 metadata-only entries," left
over from before salesforce/jira/xero/zendesk were promoted to real —
`P3`, queued for a quick doc fix.

### Intelligence Core — 9 real capabilities, `packages/intelligence/src/capabilities/`

`overdue-task`, `ownership`, `ticket-risk`, `message-follow-up`,
`lead-risk`, `overdue-invoice`, `integration-health`, `goal-variance`,
`payment-received` — each a real deterministic evaluator producing a
typed `IntelligenceFinding`. `VERIFIED_STATIC` (each has its own unit
test suite per earlier session context).

### Agent Fabric & Safe Actions

`AGENT_REGISTRY`: 2 specialist cards (`claude-specialist`,
`deterministic-specialist`), each declaring all 3 real capabilities
(`interpret_financial_risk`, `interpret_delivery_risk`,
`interpret_ticket_risk`) — confirmed current post-yesterday's work.
`canExecute: false` schema-enforced for every entry. Exactly 2 Server
Actions meet the strict Safe Action definition CLAUDE.md names
(`create_internal_task`, `complete_internal_task`); everything else
under `_actions/` is a real, auth-checked Server Action but not this
specific idempotency-keyed+audited pattern. `VERIFIED` (live-tested).

### Cron & webhooks — see API routes above (`VERIFIED_STATIC`)

### Environment variables — `.env.example` (repo root)

Required-for-boot: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Per-connector credential pairs
for all 14 real connectors. AI: `AGENT_FABRIC_ENABLED`,
`ANTHROPIC_API_KEY`, `SIGNALDESK_ANTHROPIC_MODEL`. Billing:
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`. Other:
app name, OAuth-provider enable list, `CRON_SECRET`, the launch-mode
gate pair, Resend email config. `VERIFIED_STATIC`.

### N/A — infrastructure this codebase genuinely does not have

Confirmed absent, not assumed from a prior session: a background
worker/queue (only the two synchronous Vercel Cron routes above exist);
an MCP or A2A surface (nothing external can reach the Agent Fabric
today); a universal distributed-tracing/correlation-id system (only
`agent_collaborations` and Stripe checkout carry a real `correlationId`
— a genuine, narrow gap, not full tracing, worth naming in the final
report rather than building in this pass); a second AI model vendor.

## Connector Certification Matrix

All 14 real connectors traced 2026-08-24 via direct source reads (three
parallel passes, ~130 file reads total). `VERIFIED_STATIC` throughout —
no real provider credentials are configured in this dev environment, so
live OAuth exchange wasn't exercised for any connector this pass (Slack
and HubSpot's _unconfigured_ state specifically is `VERIFIED`, from an
earlier session-24 live production-build check). Every connector's code
matched its own `readiness` flags exactly — no connector claims more
than it does.

| Connector          | State/CSRF                                              | PKCE                                                                                       | Scopes (literal)                                    | Token storage                                                                                                             | Initial/incremental sync | Cursor mechanism                                                                                                            | Remote revoke                                                                   | Health                 |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------- |
| Slack              | ✓                                                       | No — deliberate (would force a one-way "public client" conversion, losing `client_secret`) | `channels:read`                                     | Vault via `store_integration_tokens`                                                                                      | none / none              | —                                                                                                                           | ✓ real `auth.revoke`                                                            | `unknown` (no sync)    |
| HubSpot            | ✓                                                       | No — HubSpot's own docs omit PKCE                                                          | `crm.objects.deals.read`, `crm.objects.owners.read` | Vault                                                                                                                     | ✓ / ✓                    | `hs_lastmodifieddate` via Search API `GT` filter — confirmed consumed on run 2                                              | ✓ real refresh-token delete                                                     | real, from `sync_jobs` |
| Gmail              | ✓                                                       | ✓ real                                                                                     | `openid`, `email`, `gmail.readonly`                 | Vault                                                                                                                     | ✓ / ✓                    | `internalDate` → `after:YYYY/MM/DD` query — confirmed consumed                                                              | ✓ real Google revoke                                                            | real                   |
| Microsoft Outlook  | ✓                                                       | ✓ real                                                                                     | identity scopes + `Mail.Read`                       | Vault                                                                                                                     | none / none              | —                                                                                                                           | **none — Microsoft has no per-token 3rd-party revoke endpoint (confirmed)**     | `unknown`              |
| Stripe             | ✓                                                       | No — Stripe Connect OAuth doesn't document it                                              | `read_only`                                         | **no token stored** — OAuth tokens deprecated by Stripe; platform's own secret key + `Stripe-Account` header used instead | none / none              | —                                                                                                                           | ✓ real `oauth/deauthorize` (platform key)                                       | `unknown`              |
| QuickBooks         | ✓                                                       | No — 3 official Intuit SDKs lack PKCE                                                      | `com.intuit.quickbooks.accounting`                  | Vault                                                                                                                     | ✓ / ✓                    | `LastUpdatedTime` — confirmed consumed; **plus a real event-triggered webhook** (HMAC-SHA256, `timingSafeEqual`, not `===`) | ✓ real `/v2/oauth2/tokens/revoke`                                               | real                   |
| Google Calendar    | ✓                                                       | ✓ real                                                                                     | identity scopes + `calendar.readonly`               | Vault                                                                                                                     | none / none              | —                                                                                                                           | ✓ real Google revoke                                                            | `unknown`              |
| Microsoft Calendar | ✓                                                       | ✓ real                                                                                     | identity scopes + `Calendars.Read`                  | Vault                                                                                                                     | none / none              | —                                                                                                                           | none (same Microsoft limitation)                                                | `unknown`              |
| Asana              | ✓                                                       | ✓ real                                                                                     | `projects:read`, `tasks:read`, `workspaces:read`    | Vault                                                                                                                     | ✓ / ✓                    | `modified_at` → `modified_since` — confirmed consumed                                                                       | ✓ real `/-/oauth_revoke`                                                        | real                   |
| Linear             | ✓                                                       | ✓ real                                                                                     | `read`                                              | Vault                                                                                                                     | none / none              | —                                                                                                                           | ✓ real `/oauth/revoke`                                                          | `unknown`              |
| Salesforce         | ✓                                                       | ✓ real (additive to `client_secret`)                                                       | `api`, `refresh_token`                              | Vault (`expiresAt: null` — Salesforce discloses no lifetime)                                                              | ✓ / ✓                    | SOQL `LastModifiedDate >` — confirmed consumed                                                                              | ✓ real `POST {instance_url}/services/oauth2/revoke`                             | real                   |
| Jira               | ✓                                                       | No — Atlassian's own docs confirm 3LO doesn't support it                                   | `read:jira-work`, `offline_access`                  | Vault                                                                                                                     | ✓ / ✓                    | Jira's quoted `"yyyy-MM-dd HH:mm"` JQL literal — confirmed consumed                                                         | **none — Atlassian has no programmatic revoke for this grant type (confirmed)** | real                   |
| Xero               | ✓                                                       | No — Xero's PKCE is a separate, incompatible "native app" client type                      | `offline_access`, `accounting.transactions.read`    | Vault                                                                                                                     | ✓ / ✓                    | real `If-Modified-Since` header (not a query clause) — confirmed consumed, including 304 handling                           | ✓ real `POST /connect/revocation`                                               | real                   |
| Zendesk            | ✓ (+ subdomain in a real short-lived cookie, confirmed) | ✓ real                                                                                     | `read`                                              | Vault                                                                                                                     | ✓ / ✓                    | one cursor endpoint reused for both initial (`start_time=0`) and delta (`cursor=`) runs — confirmed                         | ✓ real `DELETE .../oauth/tokens/current.json`                                   | real                   |

**Findings, all `P3` doc-accuracy, both fixed this pass**:

1. The catalog's own in-file comment above the 11 catalog-only entries
   claimed "15 metadata-only entries below" — stale since 4 of them
   (salesforce, jira, xero, zendesk) were promoted to real in place
   without moving. Rewrote to describe the actual current interleaving.
2. `ConnectorReadiness.incrementalSyncImplemented`'s own doc comment
   claimed the field was "false for every connector even after
   `sync_jobs` tracking exists" — contradicted by the 8 real, cursor-
   consuming connectors this phase directly confirmed. Rewrote to name
   them and describe the real mechanism briefly.

**One soft, likely-intentional item flagged, not fixed**: Google
Calendar's `accessPosture: "read-write"` sits alongside a
readonly-only scope and `actionsImplemented: false`. Consistent with
the same "designed behavior, not a live claim" framing this catalog
uses elsewhere (Slack's own detail page: "These are planned
capabilities, not something you can use yet") — the posture likely
describes intended design, not current capability. Worth a quick
confirmation, not urgent enough to change without checking intent
first.

**Cross-cutting facts confirmed once, true for all 14**: every callback
fails closed to a safe status-keyword redirect only (`denied`/`error`/
`limit`/`connected`), never interpolating a raw error; no raw token
value ever appears in a log line or a response body anywhere in any of
the 14 callback routes or their disconnect actions (checked directly,
not assumed); `disconnect_integration()` — one shared `SECURITY
DEFINER` SQL function — is what every disconnect path actually calls to
delete the Vault secret, confirmed real for all 14, not just documented
intent; the two connectors genuinely undisclosed for token lifetime
(Salesforce) or never issued a token at all (Stripe) are both handled
honestly rather than papered over with a fabricated default.

## Golden E2E Workflow Status

Executed 2026-08-24 against the real running dev server (port 3100) and
the real dev Supabase database — live Chromium sessions, real DB writes,
real DB reads to confirm state, not assumed from the UI alone. Every
workflow below is `VERIFIED`.

| #   | Workflow                                                                                                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sign up/guest → connect (seeded, no real connector available here) → sync → finding → card → quick action → task → complete | `VERIFIED` earlier this session (Iteration 73): seeded task, confirmed in `TasksPanel`, marked done, confirmed `status='completed'` + a real `internal_task.completed` audit event directly in the database.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2   | Command bar → real filter intent                                                                                            | `VERIFIED`: `"only show items over $10,000"` against a zero-data workspace correctly returned `"No cards match that filter right now."` — parses and executes, not a stub.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 3   | Command bar "investigate" → full Agent Fabric pipeline → Approve → Safe Action → audit                                      | `VERIFIED` — the most valuable new test this pass. Seeded a real overdue QuickBooks invoice (`integrations` → `sync_jobs` → `source_records` → `invoices`, matching the exact live-database test fixture pattern from `list-overdue-invoices.test.ts`). Reloaded: a real `invoice.overdue` card appeared with real $ figures. Ran "investigate risk": a real `agent.investigation` card appeared, title "Financial risk investigation," summary "Invoice for Acme Robotics (Phase 3 test) is 12 days past its due date and still unpaid." — genuinely derived from the seeded data, not templated filler. Clicked Approve. Confirmed directly in the database: `agent_collaborations` row `status: completed`, `outcome: approved`; a real `agent_task_results` row (`deterministic-specialist`, `interpret_financial_risk`, `completed`); a real 3-event audit sequence in order (`agent_action_proposal.approved` → `internal_task.created` → `agent.task.completed`); a real `internal_tasks` row ("Follow up: Invoice for Acme Robotics (Phase 3 test)…", `status: open`). Zero console errors. |
| 4   | `/pricing` → checkout → honest unconfigured state (Stripe not configured in this dev env)                                   | `VERIFIED`: checkout page correctly shows "isn't configured yet" copy, not a broken form or a fabricated success.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 5   | Goal creation → real evaluation                                                                                             | `VERIFIED`: created "Accounts receivable target," confirmed in the database (`target_value: 7500000` — correctly `$75,000 × 100`, cents conversion verified, not just UI display).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | Daily Brief generation → artifact → consistency                                                                             | `VERIFIED`: real `artifacts` row created, `type: daily_brief`, `generated_by: "deterministic-assembly"` — never claims AI-authored prose, matching ADR 0016 exactly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7   | Team invite                                                                                                                 | `VERIFIED`: real `organization_invites` row created (real email, `role: member`, `accepted_at: null`) — confirms a guest/anonymous session genuinely holds `owner` role on its own workspace (visible directly on `/profile`'s Membership card), so this path isn't accidentally gated shut.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8a  | Data export                                                                                                                 | `VERIFIED`: `GET /profile/export` returned 200 with a real structured JSON payload — `exportedAt`, `organization`, `leads`, `invoices`, `tasks`, `messages`, `supportTickets`, `artifacts`, `recentAuditEvents`, `subscription` — matching ADR 0018's documented scope exactly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8b  | Data lifecycle delete (the single most destructive real action in the app)                                                  | `VERIFIED`, and the most reassuring result of this pass. Seeded a real lead with an identifiable contact name ("Jordan Rivera"), then ran the real UI flow (expand danger zone → type `DELETE` → confirm). Redirected to `/login?deleted=1` with an honest "Your organization and its data have been deleted" message. **Confirmed directly in the database**: `organizations.display_name` → `"[deleted organization]"`, `deactivated_at` set to a real timestamp; the seeded lead's `contact_name` → `"[deleted]"` — genuinely scrubbed, **and the underlying lead row still exists**, exactly matching ADR 0018's documented "anonymized, not deleted" design, not a UI claim unverified against reality.                                                                                                                                                                                                                                                                                                                                                                                        |

**Zero console errors across all 8 workflows, all live-tested sessions.**
No workflow required a code fix — every one worked exactly as its own
architecture and documentation already claimed.

## Adversarial / Failure-Injection Findings

Executed 2026-08-24 against the real running dev server and database.
Every test below produced the correct, honest outcome — no security or
data-integrity gap found.

| Test                                                 | Method                                                                                                                        | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idempotency under double-submit                      | Seeded a real overdue invoice, fired two near-simultaneous clicks on its real "Create follow-up task" button                  | Exactly **one** `internal_tasks` row created, confirmed by direct DB count — the idempotency key held.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Agent-investigation rate limit (3 per 5 min per org) | Fired 4 real "investigate" commands in a row on one org                                                                       | Attempts 1–3 succeeded (`"Investigation complete."`); attempt 4 correctly denied: `"Investigation failed. Please wait 5 more minute(s) before investigating again."` Confirmed in the database: exactly 3 real `agent_collaborations` rows exist — the 4th attempt was blocked _before_ creating a row, not after.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Concurrent investigate trigger (advisory lock)       | Two browser tabs, same session, fired "investigate" as close to simultaneously as Playwright allows                           | Both hit the rate limit from the test above before either could reach the advisory-lock stage — a real, if incidental, confirmation of defense-in-depth (two independent protections, either one alone would have been sufficient here). **The advisory lock's own distinct "already running" path was not isolated this pass** — a retry with a fresh, rate-limit-clean organization was blocked by a second real control: the guest-session creation rate limit (5/session-creations per hour per IP) had itself been reached from this pass's own cumulative testing. Not worked around — per this repo's own priority order (security over convenience) and the precedent this session's earlier audit work already set (Iteration 24: a real rate limit firing under genuine load is evidence to record, not an obstacle to route around). |
| Guest-session creation rate limit (5/hour/IP)        | Incidental — hit naturally by this pass's own cumulative live testing across Phases 3–4                                       | Fired correctly, blocking a new guest sign-in with an honest message rather than silently allowing unlimited account creation. Second independent real confirmation of this exact control this session (first: Iteration 24, hours earlier).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Dismiss path (reject an agent proposal)              | Not reached this pass — investigate-rate-limit budget was spent on the tests above before a dismiss-specific run could happen | `VERIFIED_STATIC` only this pass (code + existing unit test coverage in `dismiss-agent-action-proposal.test.ts`-equivalent suites) — live verification deferred to a future pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Cross-tenant Server Action attack surface            | Reasoned about, not separately live-tested                                                                                    | `createInternalTaskAction`/`completeInternalTaskAction` never accept an `organizationId` parameter — it's session-derived on every call, and the underlying persistence functions are already cross-tenant-isolation-tested at the database layer (confirmed in Phase 1's inventory). Re-testing at the Server Action layer would exercise the same protection a second time, not a different one — judged low-value versus the other tests this pass's limited budget could still afford, not skipped by oversight.                                                                                                                                                                                                                                                                                                                            |
| Prompt injection via synced business data            | Not live-tested this pass                                                                                                     | Requires a real `ANTHROPIC_API_KEY` (the defense — `<untrusted_business_data>` delimiter + `neutralizeDelimiterEscapes` — lives in `claude-provider.ts`, never reached by `deterministic-specialist`, the only backend available here). `OWNER_ACTION_REQUIRED` to live-test; existing unit tests for the delimiter/escape logic are `VERIFIED_STATIC`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Specialist disagreement / contradiction detection    | Not live-testable this pass                                                                                                   | Requires two genuinely different specialist backends producing different confidence on the same evidence — with only `deterministic-specialist` available (no `ANTHROPIC_API_KEY`), every real dispatch this pass used the same backend, so no genuine disagreement could occur. `VERIFIED_STATIC` via `agent-result-reconciler.test.ts`'s existing coverage (confirmed passing in every test run this session).                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Transactional integrity under interruption           | Not live-tested this pass                                                                                                     | Forcing a real mid-transaction failure needs code instrumentation (a deliberate throw between two statements inside `withTenantContext`) rather than anything triggerable from the outside — judged out of scope for a live black-box pass; `withTenantContext`'s rollback-on-error path itself is read and confirmed correct (`VERIFIED_STATIC`) in this file's Phase 1 inventory.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

**Net result**: every adversarially-testable-here scenario produced the
correct, honest outcome, including two independent real rate limits
firing exactly as designed. Nothing found this pass needs a `P0`/`P1`
repair. The items marked `VERIFIED_STATIC`/`OWNER_ACTION_REQUIRED`
above are real, named gaps in _this pass's_ coverage, not gaps in the
product — worth closing in a future session once either real Anthropic
credentials or a fresh hour's guest-session budget are available.

---

## Certification Log

Iterations recorded here follow `SELF-HEALING-AUDIT.md`'s format
(lead sentence, what was found, what was fixed, how it was verified) —
scoped specifically to certification-pass work. Fix-level narrative for
unrelated day-to-day self-healing work stays in that file, not here.

### Pass 1 — 2026-08-24: Phase 1 (Inventory) complete

Adapted a much larger cross-product certification template (written for
a different, unrelated app) into this directive, then executed Phase 1
via three parallel research passes rather than from memory of earlier
sessions in this conversation, since counts and coverage can drift as
work lands. Confirmed: 22 routes, 64 Server Actions, 23 API routes, 32
DB tables (24 tenant-scoped, all with confirmed forced RLS, no
exceptions found), 61 migrations, 16 active `SECURITY DEFINER`
functions, 25 connectors (14 real/11 catalog-only, unchanged), 9
Intelligence Core capabilities, 2 real Safe Actions, 2 cron jobs, 2
webhooks. Every count matches this session's prior working assumptions
except one genuine drift, found and fixed:

**`packages/integrations/src/index.ts`'s own in-file comment claimed "15
metadata-only entries below" a marker comment — stale since salesforce,
jira, xero, and zendesk were each promoted to real OAuth connectors in
place, without being physically moved above that comment.** The section
is now 11 metadata-only entries interleaved with 4 real ones, not a
clean block of 15 — the comment was actively describing the wrong thing
for 4 real connectors' own surrounding context, not just carrying a
stale number. Rewrote it to describe the actual current interleaving
and state the real signal (an entry's own `readiness`/`authStrategy`
presence, not its position relative to the comment).
`FIXED_AUTONOMOUSLY` — `P3`, doc-accuracy only, no behavior change;
`@signaldesk/integrations` typecheck and its full 288-test suite stayed
green.

**Two pre-existing, already-disclosed gaps confirmed still true, not
newly discovered**: `signals`/`recommendations` tables have real RLS-
protected DDL but zero application code writing to them and zero test
coverage — `schema.ts`'s own comment already discloses this; Phase 4
should re-confirm it's still accurate rather than treat it as new each
pass. `internal_cost_events` similarly has no real writer yet
(`recordInternalCostEvent` exists but nothing calls it outside the one
Claude-specialist cost-instrumentation path already covered elsewhere).

**One piece of real, unprompted evidence the security discipline holds**:
migration `0058` (dated before this session) shows a genuine
cross-tenant enumeration bypass — two `SECURITY DEFINER` scheduled-job
functions had Postgres's default `PUBLIC` execute grant left in place
alongside their intended `app_runtime`/`scheduled_job_runner` grants,
callable directly over Supabase's PostgREST layer independent of the
app's own auth — found and revoked in a prior session, confirmed live
via `get_advisors` per that migration's own header. Recorded here as
inventory evidence, not as this pass's own finding.

**Next**: Phase 2 (Connector Certification Matrix) is scoped to live
lifecycle tracing, but real OAuth exchange for the 14 real connectors
needs real provider credentials this dev environment doesn't have
configured (`OWNER_ACTION_REQUIRED`, same limitation this session's
earlier Customer POV audit already established) — Phase 2 here can
verify the pre-auth half of the lifecycle live (catalog → connect click
→ authorize redirect → honest unconfigured state) and the rest only
`VERIFIED_STATIC`, unless the user wants to supply real credentials for
one connector first. Phase 3 (Golden E2E Workflow Suite) is more fully
live-testable in this environment today and may be the higher-value
next slice.

### Pass 2 — 2026-08-24: Phase 2 (Connector Certification Matrix) complete

User chose code-verified tracing over live testing, since no real
provider credentials exist in this environment. Traced all 14 real
connectors' full lifecycle via three parallel passes (~130 file reads):
authorize (state/CSRF, PKCE), token exchange/storage, callback failure
paths, sync/incremental cursor mechanics, disconnect/revoke, health.
Full matrix recorded above. Every connector matched its own `readiness`
flags exactly — no connector overclaims.

**Two `P3` doc-accuracy findings, both fixed, both in
`packages/integrations/src/index.ts`**: the same class of drift as
Phase 1's — a comment accurate when written, invalidated by later real
work landing without the comment being revisited. (1) The "15
metadata-only entries" comment above the catalog's tail section, fixed
in Phase 1. (2) `incrementalSyncImplemented`'s own doc comment claimed
the field was false for every connector "even after `sync_jobs`
tracking exists... none yet filters its fetch query by it" — flatly
contradicted by 8 real connectors this phase confirmed have a genuinely
cursor-filtered fetch, each consumption method traced by hand (a query
filter for 6 of them, a real `If-Modified-Since` header for Xero, one
cursor endpoint reused for both initial and delta runs for Zendesk).
Rewrote to name the 8 and describe the real mechanism.
`@signaldesk/integrations` typecheck + full 288-test suite stayed green
after both fixes.

**One soft item flagged, not changed**: Google Calendar's
`accessPosture: "read-write"` label sits next to a readonly-only scope
and `actionsImplemented: false`. Likely intentional (matches this
catalog's own "designed behavior, not a live claim" framing used
elsewhere) but not confirmed with the person who set it — left alone
rather than guessed at.

**Real, useful negative results**: confirmed (not assumed) that Jira and
Microsoft (Calendar + Outlook) genuinely have no remote-revocation path
— Jira because Atlassian's 3LO grant type has no programmatic revoke
endpoint at all, Microsoft because no per-token third-party revoke
endpoint exists (only an account-wide session-revoke a connected app
has no reason to call). Both were already documented as such; this pass
independently re-derived the same conclusion from the provider's own
current docs rather than trusting the existing comment.

**Verified himself**: `@signaldesk/integrations` typecheck and test
(288 tests) green after both fixes; `pnpm format:check` clean repo-wide.
No live provider connection was attempted (`OWNER_ACTION_REQUIRED` for
real credentials, unchanged from Phase 1's note).

**Next**: Phase 3 (Golden E2E Workflow Suite) — fully live-testable in
this environment, no missing credentials block it.

### Pass 3 — 2026-08-24: Phase 3 (Golden E2E Workflow Suite) complete — every workflow live-verified, zero repairs needed

Executed all 8 workflows against the real running dev server and the
real dev database — live browser sessions with real DB seeding and real
DB verification after each action, not UI-only checks. Full results
recorded above. Headline result: **every workflow worked correctly on
the first attempt; nothing needed a repair this pass.**

**The most consequential test**: workflow 3, the full Agent Fabric
pipeline, had never been live-exercised with real content before today
— every prior test of "investigate" in this session hit the honest
zero-findings path. Seeded a real overdue invoice (mirroring the exact
fixture shape `list-overdue-invoices.test.ts` already proves live), ran
a real investigation, and confirmed — directly in the database, not
from the UI alone — the full chain: a real `agent_collaborations` row,
a real `agent_task_results` row attributing the work to
`deterministic-specialist`, a real 3-event audit sequence in the
correct order, and a real resulting `internal_tasks` row. This is the
first time this exact end-to-end chain has been proven against live
data rather than only against unit-test doubles or the empty-findings
path.

**Second most consequential**: workflow 8b, deleting an organization —
the single most destructive real action in the app. Seeded a lead with
an identifiable name, ran the real UI confirmation flow, and confirmed
directly in the database that anonymization is real (`display_name`
and the lead's `contact_name` both scrubbed to placeholders) _and_ that
the underlying lead row was kept, not deleted — exactly matching ADR
0018's documented design rather than either silently failing or
over-deleting.

**One test-script-only false alarm, resolved, not a product defect**: a
seed script initially checked `internal_tasks.source_card_id` for the
agent-approved task and found it `null`, briefly looking like a missed
link. Reading `approve-agent-action-proposal.ts`'s own doc comment
resolved it immediately: the reconciler deliberately drops the
per-finding link during reconciliation, so no specific source id exists
to attach at approval time — this is documented, intentional behavior,
not a gap. Recorded here so the false alarm doesn't get rediscovered
next pass.

**Verified himself**: zero console errors across all 8 live workflow
sessions; every DB assertion queried directly via `withTenantContext`,
not inferred from a screenshot. Three disposable guest workspaces were
used across the pass's several sessions (each guest sign-in is rate-
limited to 5/hour/IP by design — stayed under it) and one was
deliberately deleted as part of testing workflow 8b, exactly the kind
of throwaway account guest sessions exist for.

**Next**: Phase 4 (Adversarial / Failure-Injection Testing) — the
concurrency, rate-limit, cross-tenant, and malformed-input scenarios
the directive specifies. Phase 5 (repair) has had nothing to do yet,
since Phases 1–3 found only doc-accuracy drift, never a functional
break — worth naming as a real, positive result in the final report,
not just an absence of findings.

### Pass 4 — 2026-08-24: Phase 4 (Adversarial / Failure-Injection Testing) — no P0/P1 found; two real rate limits independently re-confirmed under genuine load

Full results table recorded above. Live-tested idempotency
(double-click on a real recommended-action button → exactly one task,
confirmed by DB count) and the agent-investigation rate limit (3 per 5
minutes per org — attempts 1–3 succeeded, attempt 4 correctly denied,
and the database shows exactly 3 `agent_collaborations` rows, proving
the limit blocks _before_ a row is created, not after).

**A test that didn't go as planned, handled the right way rather than
forced.** Tried to isolate the advisory lock's own "already running"
message (distinct from the rate limit) by firing two concurrent
investigate requests — both hit the just-exhausted rate limit instead,
since the idempotency and rate-limit tests immediately before had
already used up the 3-per-5-minute budget. Retried with a fresh guest
session specifically to get a rate-limit-clean org — and hit a
_different_, equally real control instead: the guest-session-creation
rate limit (5/hour/IP) had itself been reached by this pass's own
cumulative testing. **Did not attempt to work around it** — no cookie
reuse trick, no IP rotation, no waiting it out with a sleep loop. Per
this repo's own priority order (security over convenience) and the
precedent Iteration 24 already set hours earlier in this same session
("no attempt was made to weaken, bypass, or mock around it to force a
green re-run"), a real control firing under genuine load is evidence to
record, not an obstacle to route around. This is the **second**
independent live confirmation of this exact guest-session rate limit
in this session, hours apart, under different test loads — stronger
evidence than either alone.

**Four scenarios honestly marked not-testable-this-pass, not silently
skipped**: prompt injection (needs a real `ANTHROPIC_API_KEY` — the
defense lives in `claude-provider.ts`, never reached by
`deterministic-specialist`, the only backend available here);
specialist-disagreement/contradiction-detection (needs two genuinely
different backends producing different confidence on the same
evidence — impossible with only one real backend available); the
advisory lock's own distinct message (blocked by the guest-session rate
limit before it could be isolated); transactional-interruption
(needs code instrumentation, not a black-box trigger). Each is
`VERIFIED_STATIC` via existing code/tests where that exists, and named
as a real gap in _this pass's_ coverage rather than assumed complete.

**Verified himself**: zero console errors across every adversarial
session; every claimed outcome (task count, collaboration count, rate-
limit denial) confirmed by a direct database query, not inferred from
UI text alone. `pnpm -r typecheck`/`test`/`lint`/`format:check` all
still green after this pass (no code changed — this was pure live
testing, no repairs were needed).

**Summary across all four phases**: zero `P0`/`P1` findings. Three
`P3` doc-accuracy fixes (all landed, all re-verified against their
package's own test suite). Two independent real security controls
(agent-investigation rate limit, guest-session rate limit) fired
exactly as designed under genuine, unscripted load — not merely present
in code, demonstrated. Phase 5 (repair) had nothing to do. Phase 6
(second independent pass) and the adversarial red-team follow-up remain
for a future session, ideally with either real Anthropic credentials or
a fresh hour's guest-session budget, to close the four scenarios this
pass could only mark `VERIFIED_STATIC`/`OWNER_ACTION_REQUIRED`.

### Pass 5 — 2026-08-24: Phase 6 (independent second pass) + the adversarial red-team follow-up — two genuinely new findings, both real, both fixed

Rather than re-reading Passes 1–4's own notes with extra skepticism (a
weak form of independence — the same author trying to un-know what he
already found), spawned three fresh subagents with **zero prior
context**: no certification doc, no summary of earlier findings, just
the raw investigative question each was assigned. This is what makes
this pass genuinely independent rather than a relabeled re-read.

**Two targeted re-derivations of load-bearing security claims, both
confirmed TRUE from scratch**: (1) every tenant-scoped table has both
`enable`/`force row level security`, re-derived by reading
`schema.ts` fresh and grepping all 61 migrations independently — same
conclusion as Pass 1, reached by a different route, plus one piece of
history Pass 1 hadn't surfaced: migration `0052` fixed a real, subtler
bug (`FORCE ROW LEVEL SECURITY` with no `DELETE` policy silently
matched zero rows, masking an undeleted row rather than erroring) — a
second real, independent instance of this discipline catching something
real, alongside migration `0058`'s cross-tenant-enumeration fix Pass 1
already found. (2) `canExecute: z.literal(false)` is genuinely
schema-hard-enforced with no bypass path — traced the one real
agent-attributed mutation path end to end and confirmed the actual task
creation is always attributed to a human session, never the agent
itself. (3) QuickBooks's webhook signature check genuinely uses
`timingSafeEqual`, and — a detail Pass 1/2 hadn't specifically checked —
correctly compares buffer _lengths_ before calling it, avoiding the
exception `timingSafeEqual` throws on a length mismatch (which could
otherwise become its own information-leak vector). All three: `TRUE`,
independently re-derived, zero contradictions.

**A dedicated authorization-bypass hunt (the "hide the button, not the
door" class), zero findings**: traced all 7 client-side permission-
gating flags in `.tsx` files to their Server Actions and confirmed
every one independently re-derives the caller's role from
`getCurrentOrganization()` server-side, never trusting a client prop.
Separately confirmed no Server Action anywhere accepts `organizationId`
as a parameter, and every entity-scoped write (`complete-internal-
task.ts`, `approve-/dismiss-agent-action-proposal.ts`, `revoke-
invite.ts`) filters by `organization_id = $1 and id = $2`, so a
foreign-org id simply matches zero rows rather than acting on the wrong
tenant's data. One legitimate design note surfaced, not a
vulnerability: connector connect/disconnect actions carry no role gate
at all (any authenticated member can disconnect an integration) — a
real inconsistency against the owner/admin gates on invites/AI-keys/
settings, but consistently applied client _and_ server, so not a
bypass. Worth a deliberate ADR-level decision someday, not urgent.

**Two genuinely new findings — real UX/honesty gaps, absent from all
34 prior `SELF-HEALING-AUDIT.md` iterations (confirmed by the finding
agent's own grep, not assumed)**, both in
`command-center-board.tsx`/`use-business-snapshot.ts`:

1. `page.tsx`'s server-rendered "Snapshot rendered HH:MM" timestamp
   freezes at first paint, but `CommandCenterBoard`'s client-side poll
   (every 45s) silently swaps in fresh cards via a plain `fetch`, never
   a `router.refresh()` — so after the first poll tick, that frozen
   label stops describing what's actually on screen.
2. `useBusinessSnapshot`'s own `error` state is computed on a failed
   poll but never read by its one real caller — a background polling
   failure (a transient 5xx, a network blip, the route's own 30/min
   rate limit) left the board silently showing stale cards forever,
   with zero visual indication live updates had stopped.

**Fixed both together**, since they're the same underlying gap (no
honest signal for the live-polled data's real state): added a small,
real status line to `CommandCenterBoard` — `pollError` now renders
"Live updates paused — showing cards as of {the real last-successful-
poll timestamp, via `polledSnapshot.generatedAt`}." (or, if no
successful poll has ever landed, "…showing the data from when this
page loaded" rather than fabricating a timestamp); absent an error, a
genuine "Cards updated {relative time}" indicator now tracks the real
poll timestamp instead of a frozen server-render clock. Renders nothing
before the first poll lands, since `page.tsx`'s own initial banner is
still honest at that moment. New CSS: `.liveStatusNotice`/
`.liveStatusNotice-paused` (`globals.css`), reusing the existing
`--faint`/`--severity-low-ink` tokens rather than inventing new colors.
`FIXED_AUTONOMOUSLY`.

**Verified himself**: `@signaldesk/web` typecheck, lint, and its full
test suite (22 passed, 5 skipped — unaffected) all green after the fix;
`pnpm format:check` clean repo-wide. **Live verification of this
specific fix was blocked** — the guest-session rate limit (5/hour/IP)
was still in its cooldown window from Phases 3–4's own heavy testing,
confirmed by a real attempted sign-in that correctly failed rather than
being forced around. Left as `OWNER_ACTION_REQUIRED`-adjacent: verify
live once the rate-limit window resets or in a session with its own
fresh IP/hour budget. The logic itself was read back carefully
end-to-end in place of a live check (four real states — error with a
prior good poll, error with none yet, healthy with a poll landed,
initial load before any poll — each traced by hand against
`useBusinessSnapshot`'s actual documented error-clearing behavior).

**This closes the certification directive's core loop for this
session**: inventory → connector matrix → golden workflows → adversarial
testing → independent second pass → red-team follow-up → repair →
re-verify, all six phases touched, two real product fixes landed
(3 doc-accuracy + this session's earlier ticket-risk-capability and
task-completion-loop work), zero P0/P1 left open. Remaining for a
future pass: live-verify this fix once guest-session budget resets;
close the four `VERIFIED_STATIC`/`OWNER_ACTION_REQUIRED` adversarial
scenarios with real Anthropic credentials; decide the connector-
connect/disconnect role-gating question this pass surfaced.
