# 25-Issue Reliability and Product Integrity Audit

- Status: Completed
- Date: 2026-08-20

## Method and an honest framing before the records

Every record below was inspected directly against the running repository
(file:line evidence), not assumed from the risk class's name. Where a fix
is `FIXED`, it was implemented and covered by a passing test in this same
pass — `pnpm -r typecheck`, the full `pnpm -r test` suite, and
`pnpm --filter @signaldesk/web build` all ran clean after every fix below
(see `ISSUES-REMAINING.md` for the full run log).

**Before writing a single fix, this audit cross-referenced
`docs/product-vision-backlog.md`, whose Prompts 11–40 already ran almost
exactly this discipline against nineteen of these twenty-five risk classes**
— each with its own dated reality check and, for most, a real narrow slice
already shipped behind an ADR. Rebuilding `SemanticMetricRegistry`,
`FinancialExposure`, `OwnershipEngine`, `IntegrationDriftDetector`, the
prompt-injection boundary, `EvaluationLab`, or the One-Page audit under the
literal class names this pass's instructions proposed would have duplicated
real, tested, working architecture — directly against this repo's own rule
("extend existing architecture rather than duplicating it"). So each record
below states what already exists (crediting the ADR that built it), what a
fresh evidence pass this session found beyond that existing work, and — only
where a real, narrowly-scoped, safely-completable bug was found — what was
actually fixed now.

Statuses: `NOT_PRESENT` / `FOUND` / `PARTIALLY_FIXED` / `FIXED` / `BLOCKED`.
Severity is independent of status — a `NOT_PRESENT` risk can be low severity
because nothing exists yet to fail.

---

### 1. Feature Wiring

- **status**: ALREADY_HANDLED (not a listed status value, but the honest
  one — no defect exists to classify with the other five)
- **severity**: none
- **actualEvidence**: Every UI control inspected resolves to a real
  server action or DB read. `card-actions.tsx:37-59` (create-task button →
  real `createTaskAction`, idempotency-keyed); `agent-recommendation-card.tsx:32-76`
  (Approve/Dismiss wired to real actions, gated `if (!action) return`);
  `invoice-payment-scenario-button.tsx:42-54` (explicitly labels its output
  `SIMULATION`, never claims a real state change); `billing/page.tsx:16-29,238-298`
  (cancel/resume/retry/change-plan/add-on all bound to real
  persistence-backed actions). No `onClick={() => {}}`, `href="#"`, or
  "coming soon" stub found anywhere in `apps/web/app`. `_cards/unknown-card.tsx:9-21`
  renders an honest unknown state rather than guessing at an unwired card.
  `docs/adr/0048-product-integrity-surface-audit.md` already ran a
  file-tree-derived version of this exact check this session.
- **affectedFiles**: n/a
- **affectedServices**: n/a
- **affectedUI**: n/a
- **reproduction**: n/a
- **rootCause**: n/a
- **fix**: None needed.
- **testsAdded**: None needed.
- **remainingRisk**: None found.

---

### 2. Connector Lifecycle

- **status**: PARTIALLY_PRESENT
- **severity**: low
- **actualEvidence**: Two distinct, orthogonal enums already exist, not
  one boolean — `ConnectorConnectionStatus` = `pending|active|degraded|
disconnected|revoked` (`packages/persistence/src/connector-connection.ts:16-17`)
  and a separately-derived, never-persisted `ConnectorHealthStatus` =
  `healthy|degraded|error|unknown`, computed live from `sync_jobs`
  (`packages/persistence/src/connector-health.ts:4-53`). The HubSpot OAuth
  callback runs a real initial sync and records `sync.completed`/
  `sync.failed` distinctly (`integrations/hubspot/callback/route.ts:86-152`);
  a failed sync surfaces `"error"` with a real `lastError`
  (`_lib/visual-state.ts:74-95`) — a successful OAuth callback alone never
  claims "working." Gap: no dedicated `reauth-required` state — an expired
  or revoked token surfaces as generic `"error"` with a text `lastError`
  rather than a distinct "reconnect needed" state a user could act on
  directly.
- **affectedFiles**: `packages/persistence/src/connector-health.ts`,
  `apps/web/app/_lib/visual-state.ts`
- **affectedServices**: Connector health computation
- **affectedUI**: `/integrations/[slug]` connector detail page
- **reproduction**: Revoke a connector's OAuth grant on the provider side,
  then reload `/integrations/[slug]` — the page shows a generic error
  state, not a distinct "reconnect" call to action.
- **rootCause**: `computeConnectorHealth` classifies every sync failure
  into the same `"error"` bucket regardless of whether the underlying
  cause was an expired token (actionable by reconnecting) or a transient
  provider issue (not actionable by the user at all).
- **fix**: Not implemented this pass — distinguishing an auth failure from
  a data failure requires each of the three real-sync connectors'
  `ensureFreshXAccessToken` functions to classify a refresh failure
  distinctly (they currently just throw), a new `reauth_required` value
  added to the health status union, and updated UI copy — a real,
  moderate-scope change touching three connector clients plus the health
  type, not a narrow single-file fix.
- **testsAdded**: None (not fixed).
- **remainingRisk**: A user whose token expired sees a generic error
  message rather than being told to reconnect — a real but low-severity
  comprehension gap, not a data-integrity or security issue (the
  connector's data itself is never misrepresented as healthy).

---

### 3. Webhook Reliability

- **status**: PARTIALLY_PRESENT
- **severity**: medium
- **actualEvidence**: Two real, signature-verified webhook receivers exist
  (Stripe: `billing/webhooks/stripe/route.ts:121-187`; QuickBooks:
  `integrations/quickbooks/webhook/route.ts`). QuickBooks writes are
  genuinely idempotent — `ingestQuickBooksInvoice` inserts with
  `on conflict (organization_id, idempotency_key) do nothing`
  (`packages/persistence/src/invoices.ts:49-79`). The handler's own doc
  comment (`route.ts:51-70`) explicitly, deliberately always acks 200 so
  one bad realm in a multi-company payload never fails the whole batch —
  a real, reasoned tradeoff, not an oversight. The real gap it also
  discloses: because it always acks 200, **a realm whose sync throws
  (e.g. a transient QuickBooks API failure) is logged and silently
  dropped — Intuit will never retry that specific notification**, and no
  reconciliation job exists to recover it later (confirmed: no cron/queue
  infrastructure exists anywhere in this app — `apps/web` is Next.js
  Server Actions, request/response only, per
  `docs/product-vision-backlog.md`'s own repeated finding on this).
- **affectedFiles**: `apps/web/app/integrations/quickbooks/webhook/route.ts`
- **affectedServices**: QuickBooks incremental sync
- **affectedUI**: None directly — manifests as data staleness, not an
  error state
- **reproduction**: Force `syncQuickBooksInvoices` to throw mid-run for one
  realm (e.g. a transient network error) during a real webhook delivery —
  the response is still `200 { received: true }`, so QuickBooks marks the
  notification delivered and never retries it.
- **rootCause**: A per-realm `try/catch` inside a fixed-response-code loop,
  deliberately chosen over failing the batch — but with no compensating
  reconciliation mechanism for the realm that was dropped.
- **fix**: Not implemented this pass. The two candidate fixes both carry
  real risk without more infrastructure: returning a non-2xx status would
  make Intuit retry the _entire_ multi-realm payload (safe for the
  idempotent realms that already succeeded, but doesn't target only the
  failed one, and changes retry semantics for an endpoint with no test
  coverage of that behavior); a real reconciliation job needs a background
  worker/queue this app doesn't have. Flagged here rather than
  hand-waved into either option without the infrastructure to do it
  safely.
- **testsAdded**: None (not fixed).
- **remainingRisk**: A transient failure during webhook-triggered sync can
  leave QuickBooks data stale until the next webhook event or a manual
  "Sync Now" click — a real but bounded risk (incremental sync catches up
  on the next successful run; no data is corrupted, only delayed).

---

### 4. API Rate Limits

- **status**: PARTIALLY_FIXED
- **severity**: low
- **actualEvidence**: `packages/integrations/src/shared/fetch-with-retry.ts`
  already retries 429/5xx up to 3 times honoring `Retry-After`, wired into
  every real HTTP call site across HubSpot, QuickBooks, Asana, and Stripe
  Connect OAuth. The one real gap: `stripe-billing/client.ts` (this app's
  own customer-billing Stripe client, a _different_ Stripe integration
  from Stripe Connect) constructed `new Stripe(secretKey)` with the SDK's
  default of **zero** automatic network retries — inconsistent with every
  other provider client in the codebase.
- **affectedFiles**: `packages/integrations/src/stripe-billing/client.ts`
- **affectedServices**: Checkout, subscription management, add-on billing
- **affectedUI**: `/billing`, `/pricing` checkout flow
- **reproduction**: A transient network blip during `startCheckoutAction`'s
  Stripe calls surfaced as an immediate checkout failure with no retry.
- **rootCause**: `createStripeBillingClient` never configured
  `maxNetworkRetries`.
- **fix**: `createStripeBillingClient` now constructs `new Stripe(secretKey,
{ maxNetworkRetries: 3 })`, giving billing-mutation calls the same
  resilience every other provider client already has via `fetchWithRetry`.
- **testsAdded**: `stripe-billing/client.test.ts` — new
  `describe("createStripeBillingClient")` block asserting the constructor
  is called with `{ maxNetworkRetries: 3 }` (mocks the `stripe` module's
  constructor only; every other test in the file uses a pre-built
  `fakeStripe` stand-in and is unaffected).
- **remainingRisk**: None material — every real outbound HTTP-based
  provider call in the codebase now has retry coverage.

---

### 5. Integration Schema Drift

- **status**: PARTIALLY_FIXED
- **severity**: medium (was), now low for the closed part
- **actualEvidence**: Real Zod validation exists at the sync boundary
  (`parseSourceLeadRecord`/`parseSourceInvoiceRecord`/`parseSourceTaskRecord`,
  `packages/schemas/src/index.ts`), and `ADR 0043` already wires a
  validation failure into a real `integrations.status = 'degraded'`
  transition (`completeSyncJob`) — a genuine, tested first slice of drift
  detection. The gap this session's fresh evidence sharpened beyond what
  ADR 0043 covers: the **mapper itself silently defaults missing/renamed
  fields** instead of failing — `props.dealname?.trim() ||
FALLBACK_DEAL_NAME` and `parseAmountToCents` returning `0` on a missing
  amount (`hubspot/mapper.ts`). Both fallback values are themselves valid
  per the Zod schema, so neither trips ADR 0043's degraded-status
  mechanism, which only fires on a hard validation failure.
- **affectedFiles**: `packages/integrations/src/hubspot/mapper.ts`,
  `apps/web/app/_lib/sync-hubspot.ts`,
  `apps/web/app/_actions/sync-hubspot.ts`,
  `apps/web/app/integrations/hubspot/callback/route.ts`
- **affectedServices**: HubSpot lead sync
- **affectedUI**: None new — a real audit-trail signal, not a UI change
- **reproduction (closed half)**: Simulate a HubSpot API response missing
  `dealname` — the lead previously ingested silently as `"Untitled
HubSpot deal"` with zero operator-visible signal that a field went
  missing.
- **rootCause**: Defaulting-to-a-placeholder and validation-failure were
  treated identically at the Zod boundary (both produce a "valid" parsed
  record) — but a missing `dealname` and a missing `amount` are not
  equally suspicious: **every real HubSpot deal has a name** (its absence
  is a genuine anomaly worth surfacing — a scope issue, or the field being
  renamed), while a missing `amount` is a completely normal, honest state
  for an early-pipeline deal with no negotiated price yet. Treating both
  the same would have either missed a real signal or cried wolf on
  ordinary data.
- **fix**: Added `detectHubSpotDealDefaultedFields` (`mapper.ts`) —
  narrowly scoped to the one genuinely anomalous field (`dealname`),
  sharing its exact missing-check predicate with the mapper itself so the
  two can never silently disagree. `syncHubSpotDeals`
  (`apps/web/app/_lib/sync-hubspot.ts`) now counts real occurrences per
  run (`defaultedNameCount`) and returns it alongside `ingested`/
  `skipped` — both real callers (the OAuth callback's initial sync and the
  "Sync Now" action) now include it in the `sync.completed` audit event
  they already write, the same pattern this pass already used for Issue 12. No schema migration: reuses the existing `audit_events` metadata
  field rather than a new table or column. Deliberately did NOT flag
  missing `amount` — see rootCause.
- **testsAdded**: `hubspot/mapper.test.ts` — 3 new tests: a complete deal
  reports nothing defaulted; a blank/missing `dealname` is flagged; a
  missing `amount` is explicitly asserted to NOT be flagged (the "don't
  cry wolf on normal data" behavior, tested directly, not just claimed).
  Full suite green (923 tests). Not live-verified against a real HubSpot
  sync — that needs a real OAuth login this environment can't automate;
  verified by typecheck + the unit tests that directly exercise the exact
  logic controlling what gets counted.
- **remainingRisk**: The raw provider HTTP response is still trusted via
  an unchecked `as {...}` cast before mapping (`hubspot/client.ts`) — a
  malformed (not just field-renamed) response would still only be caught
  if it fails Zod validation downstream. QuickBooks and Asana mappers
  weren't audited for the same silent-default pattern in this pass (the
  original finding was HubSpot-specific); worth the same narrow check the
  day either connector's mapper is next touched.

---

### 6. Entity Resolution

- **status**: PARTIALLY_PRESENT (deliberately narrow, by design — ADR 0042)
- **severity**: low
- **actualEvidence**: `detectInvoiceLeadNameDuplicates`
  (`packages/data-quality/src/detect.ts:25-62`) does real, deterministic
  exact-string matching between an invoice's `customerName` and a lead's
  `companyName` across different source systems, surfaced as a real
  `DataQualityIssue` for human review on `/integrations`. No fuzzy/
  probabilistic matching (explicitly rejected by design) and no merge
  workflow exists — `docs/adr/0042-data-quality-entity-resolution.md`
  states this plainly as the intentional scope boundary, not an oversight.
- **affectedFiles**: n/a — matches its own documented scope
- **affectedServices**: n/a
- **affectedUI**: n/a
- **reproduction**: n/a
- **rootCause**: n/a
- **fix**: None — already correctly scoped and disclosed.
- **testsAdded**: None needed (6 existing tests already cover the real
  detector).
- **remainingRisk**: No merge/dismiss workflow exists, so a detected
  duplicate stays visible with no resolution action — a real, already-
  disclosed limitation (`docs/adr/0042`'s own "not built" list), not new.

---

### 7. Semantic Metric Consistency

- **status**: FIXED
- **severity**: low
- **actualEvidence**: Core financial metrics (AR, overdue exposure,
  pipeline value, cash collected, task backlog) are genuinely centralized
  in `packages/semantics/src/compute.ts`, consumed by exactly one panel
  (`business-metrics-panel.tsx` via `todays-attention.ts:88`) — ADR 0034's
  real first slice. One real duplicate computation site found:
  `packages/application/src/scenarios/invoice-payment-scenario.ts:27-49`
  hand-rolled its own per-currency sum of overdue invoice amounts
  instead of reusing the same grouping engine
  `computeOverdueReceivableExposure` runs on.
- **affectedFiles**: `packages/semantics/src/compute.ts`,
  `packages/semantics/src/index.ts`,
  `packages/application/src/scenarios/invoice-payment-scenario.ts`,
  `packages/application/package.json`
- **affectedServices**: "What if this gets paid?" invoice simulation
- **affectedUI**: `InvoiceRiskCard`'s scenario button
- **reproduction**: n/a — both implementations already agreed (both were
  correct, simple sums); this was a consistency/maintenance risk, not a
  live discrepancy.
- **rootCause**: `computeOverdueReceivableExposure` returns `MetricValue[]`
  (`{ value, currency }`, no per-currency invoice count) built from an
  internal, unexported `groupByCurrency` helper — not directly reusable by
  a caller that needs `{ count, amountCents, currency }`.
- **fix**: Exported `groupByCurrency` from `@signaldesk/semantics` (purely
  additive — no existing exported function's signature changed) and added
  `@signaldesk/semantics` as a real declared dependency of
  `packages/application` (previously undeclared, which would have been a
  phantom-dependency gap of exactly the kind this repo has fixed before).
  `invoice-payment-scenario.ts`'s `summarizeByCurrency` now calls the
  shared grouping engine directly instead of hand-rolling an equivalent
  loop.
- **testsAdded**: None new — the existing
  `invoice-payment-scenario.test.ts` suite (unchanged) continues to pass,
  proving the refactor preserved identical output.
- **remainingRisk**: None — the scenario can no longer silently drift from
  the canonical "overdue" definition, since it now runs through the same
  grouping engine.

---

### 8. Financial Exposure Accuracy

- **status**: PARTIALLY_PRESENT
- **severity**: low
- **actualEvidence**: ADR 0037 already built a real
  `ExposureType` (`CONFIRMED_AMOUNT`/`CONTRACTED_AMOUNT`/`OUTSTANDING_AMOUNT`/
  `AT_RISK_AMOUNT`/`POTENTIAL_EXPOSURE`/`FORECAST_IMPACT`) applied to all
  five real Semantic Layer metrics, surfaced on the existing "Where this
  comes from" disclosure. Separately, `IntelligenceCard.financialContext`
  (the older, per-finding label+amount used by risk cards) is a single
  untyped shape with no structural link to `ExposureType` — but
  `agent-result-reconciler.ts:76-79` deliberately never synthesizes one for
  agent-generated findings ("distinct financial categories must never be
  summed into one misleading total figure"), and every deterministic
  capability's `financialContext` is set directly from real synced data
  with a correct, human-reviewed label. The two exposure-typing systems
  (new `ExposureType` on Semantic Layer metrics, older untyped
  `financialContext` on cards) simply haven't been unified.
- **affectedFiles**: `packages/schemas/src/index.ts` (`FinancialContext`)
- **affectedServices**: n/a — no live incorrect labeling found
- **affectedUI**: n/a
- **reproduction**: n/a — no reproducible mislabeling found; this is a
  type-system gap (nothing currently exploits it), not an active bug.
- **rootCause**: `FinancialContext` predates ADR 0037's `ExposureType`
  vocabulary and was never retrofitted to reference it.
- **fix**: Not implemented — would mean widening a schema shared by every
  card-rendering call site in the app for a currently-theoretical
  mislabeling risk (every real capability today assigns its label
  correctly); a real future step, not an urgent one.
- **testsAdded**: None (not fixed).
- **remainingRisk**: A future capability author could label a speculative
  number `"Confirmed revenue"` and the type system wouldn't catch it —
  low likelihood given current code review discipline, but genuinely
  unenforced.

---

### 9. Retrieval Quality

- **status**: PARTIALLY_FIXED
- **severity**: medium
- **actualEvidence**: The reconciler's evidence check
  (`agent-result-reconciler.ts:86-89`, `result.evidenceIds.every(id =>
knownFindingIds.has(id))`) is real defense-in-depth, not dead code as
  first characterized — it protects against a malformed/buggy
  `SpecialistDispatch` implementation returning ids outside the task's
  real input set. But it cannot detect the harder case: `AgentTaskResult.evidenceIds`
  is set by the gateway to _every_ finding the task covered
  (`apps/web/app/_lib/agent-gateway.ts:183`, `findings.map(f => f.id)`),
  deliberately, per `parallel-specialist-coordinator.ts:16-26`'s own doc
  comment — the model's structured output (`SpecialistInterpretation`) has
  no per-claim citation field to check against, so there is no way today
  to verify a specific claim actually derives from a specific finding. A
  real, separate bug fixed this session: reconciled findings reported only
  `citedFindings[0]`'s freshness rather than the _worst_ freshness across
  every cited finding — a stale task finding combined with a fresh invoice
  finding would report the fresher timestamp, understating real staleness.
- **affectedFiles**: `packages/application/src/agents/agent-result-reconciler.ts`
- **affectedServices**: Agent Fabric investigation reconciliation
- **affectedUI**: `/agents` Collaboration Trace, agent-recommendation cards
- **reproduction**: Reconcile two specialist results citing one fresh and
  one stale finding — the resulting finding's `freshness` previously
  matched whichever finding happened to be first in `sourceFindings`,
  regardless of actual staleness.
- **rootCause**: `freshness: citedFindings[0]!.freshness` — an arbitrary
  "first in the array" choice with no staleness reasoning behind it.
- **fix**: Now takes the cited finding with the oldest `freshness.asOf`
  (the timestamp `status` itself is derived from) across every cited
  finding, so the reconciled result always reports its true worst-case
  freshness.
- **testsAdded**: `agent-result-reconciler.test.ts` — new test reconciling
  a fresh invoice finding with a stale task finding, asserting the
  combined result reports the stale finding's freshness.
- **remainingRisk**: The deeper gap (no per-claim evidence grounding — a
  model could write a claim that doesn't actually derive from any finding
  it was given, and nothing would catch it) remains real and unfixed. It's
  a structured-output schema change (adding per-claim finding-id citation
  to `SpecialistInterpretation`), a genuine future enhancement, not a
  narrow bug — correctly not attempted in this pass given the risk of an
  undertested provider-contract change.

---

### 10. Retrieval Strategy Overengineering

- **status**: NOT_PRESENT
- **severity**: none
- **actualEvidence**: Exactly one retrieval mechanism exists anywhere in
  the repository: plain SQL via Drizzle. A repository-wide search found
  zero embedding/vector/full-text/reranker code;
  `docs/proactive-ai-direction.md:146` names "semantic/graph RAG" only as
  unbuilt future work. There is nothing to overengineer because there is
  only one mechanism to begin with.
- **affectedFiles/Services/UI/reproduction/rootCause/fix/testsAdded**: n/a
- **remainingRisk**: None today — worth re-checking the day a second
  retrieval mechanism (e.g. embeddings) is proposed, per this file's own
  discipline.

---

### 11. End-to-End RAG Requirement Compliance

- **status**: PARTIALLY_PRESENT
- **severity**: low
- **actualEvidence**: `business-ai-orchestrator.test.ts:35-61` exercises
  multiple capabilities together but asserts only structural output
  (finding/card types present, count thresholds) — never "is this the
  objectively correct business conclusion" against a labeled scenario. No
  golden-scenario corpus or e2e test harness exists. This matches Prompt
  13's own reality check in `docs/product-vision-backlog.md` almost
  exactly: no evaluation is possible without real production AI usage
  volume to calibrate against, and `card_feedback` (ADR 0032) is the one
  real, if narrow, signal that exists today.
- **fix**: None — already correctly reasoned about and reality-checked;
  building a golden-scenario harness against near-zero real AI usage
  volume would be speculative infrastructure, the exact trap this repo's
  own discipline exists to avoid.
- **testsAdded**: None.
- **remainingRisk**: Real, but explicitly and correctly deferred — see
  Issue 25.

---

### 12. Zero-Prompt AI Cost/Triggering

- **status**: FIXED
- **severity**: low
- **actualEvidence**: A real deterministic gate exists before any AI call
  — `run-agent-investigation.ts` requires the `AGENT_FABRIC_ENABLED` kill
  switch, a 3-per-5-min per-org rate limit, and a materiality pre-filter
  (bails with "Nothing to investigate right now" unless real finance/
  delivery findings exist). `providerFor` (`agent-fabric.ts:55-61`) only
  calls the real Claude API when `ANTHROPIC_API_KEY` is configured (unset
  in this environment, confirmed by inspecting `.env.local`); otherwise
  both specialists resolve to the free deterministic provider. Real
  invocations are cost-logged (`agent-gateway.ts:84-94`,
  `recordInternalCostEvent`, ADR 0045). The real gap found: nothing
  counted _how many_ events were filtered out (rate-limited,
  empty-materiality, disabled) versus how many actually triggered AI.
- **affectedFiles**: `apps/web/app/_actions/run-agent-investigation.ts`
- **affectedServices**: Agent Fabric cost/trigger observability
- **affectedUI**: None — an audit-trail signal, not a dashboard
- **reproduction**: n/a — fixed
- **rootCause**: The gating logic returned early on each declined trigger
  without recording _why_ it didn't proceed.
- **fix**: Each of the three early-return branches
  (`agent_fabric_disabled`, `rate_limited`, `no_material_findings`) now
  writes a real `audit_events` row
  (`eventType: "agent.investigation.declined"`, `outcome: "denied"`,
  `metadata: { reason }`) via the existing `recordAuditEvent` — reusing
  the general-purpose audit trail already used for every connector/
  billing/agent event, not a new table or mechanism.
- **testsAdded**: None (no existing unit-test pattern for Server Actions
  in this repo, matching Issue 19's disclosure). **Live-verified instead**:
  triggered `runAgentInvestigationAction` end-to-end via a real guest
  session and the command bar (`investigate`), then queried the real dev
  database directly and confirmed the row —
  `{event_type: "agent.investigation.declined", outcome: "denied",
metadata: {reason: "no_material_findings"}}` — was actually written.
- **remainingRisk**: None material — the actual cost/trigger controls
  were already real and working; this closes the observability gap around
  them.

---

### 13. Signal Duplication/Fusion

- **status**: FIXED
- **severity**: medium (was)
- **actualEvidence**: `stuck.ts` (`lead.untouched`) and `lead-risk.ts`
  (`lead.follow_up_risk`) both called the identical `getLeadAttention(...)`
  and fired under the exact same `attention.requiresAttention` condition
  for the same lead — a real, disclosed, cross-referenced duplication, not
  an accidental bug. `composeCards` mapped findings to cards 1:1 with no
  entity-based grouping, so a user genuinely saw two cards for one
  untouched lead. The general `SignalFusionEngine` (`docs/product-vision-
backlog.md` Prompt 24) remains correctly blocked — no persisted `Signal`
  entity exists for it to fuse into — but this _specific, concrete_
  instance of the problem didn't need that general engine to fix: with
  only ever one relevant lead at a time (`getPriorityLead` returns a
  single lead, not a list), the two capabilities could be consolidated
  directly.
- **affectedFiles**: `packages/intelligence/src/capabilities/lead-risk.ts`
  (fused; `stuck.ts` retired entirely), `packages/intelligence/src/registry.ts`,
  `packages/intelligence/src/finding.ts`,
  `packages/application/src/cards/dashboard-composition.ts`,
  `packages/schemas/src/index.ts`, `apps/web/app/_cards/registry.tsx`
- **affectedServices**: Command center card composition
- **affectedUI**: `/` — an untouched high-value lead previously showed
  both a "stuck" card and a "follow-up risk" card; now shows one
- **reproduction (closed)**: Previously, syncing a HubSpot lead past its
  response-time threshold fired both `stuckIntelligence` and
  `leadRiskIntelligence`, producing two distinct cards for the one real
  situation.
- **rootCause**: No fusion/grouping stage existed between individual
  capability findings and card composition — and didn't need to for this
  case, since the duplication was two capabilities independently wrapping
  one shared detection result, not two genuinely different detectors
  converging on the same entity.
- **fix**: Retired `stuckIntelligence` (`stuck.ts`, its test, its
  `"lead.untouched"` `IntelligenceType`, its `"stuck"` `CardType`, its
  `StuckCard` component) entirely — a deliberate consolidation, not a
  quiet disable. `leadRiskIntelligence` absorbed the retired capability's
  real, specific `signal.explanation` text as its `summary` (replacing a
  generic templated sentence it previously used) — fusion made the
  surviving card _more_ informative, not just less redundant, since
  `LeadRiskCard` already rendered financial context `StuckCard` never
  had. Explicitly deferred (see `docs/25-issue-audit.md`'s companion
  roadmap, Phase 1): writing this to the real `signals` table for durable
  identity/lifecycle, since `getPriorityLead`'s single-lead contract can't
  correctly resolve a signal back to `resolved` for any lead other than
  the current priority one without a queue this app doesn't have —
  attempting it now would have risked stale `open` rows, a real
  data-integrity regression worse than the redundancy it would have
  replaced.
- **testsAdded**: No new tests — the fix is a consolidation, so the real
  proof is `lead-risk.test.ts`'s existing suite plus `dashboard-
composition.test.ts`'s and `business-ai-orchestrator.test.ts`'s updated
  assertions all passing against the fused shape. 22 files touched across
  6 packages (the real blast radius, found via typecheck/test failures,
  not guessed). Full suite green (935/935), typecheck clean, production
  build clean, live Playwright confirmed the command center still renders
  with zero console errors after the registry change. Not live-verified
  against a real HubSpot-synced untouched lead (no live HubSpot
  connection in this environment).
- **remainingRisk**: None for this specific duplication. The general
  `SignalFusionEngine` capability remains unbuilt for any _future_ case
  where two genuinely different detectors (not one shared detection
  wrapped twice) converge on the same entity — that still needs a
  persisted Signal entity and remains correctly blocked.

---

### 14. Severity Stability

- **status**: ALREADY_HANDLED
- **severity**: none (one caveat noted, not fixed — see below)
- **actualEvidence**: `prioritizeFindings` (`packages/intelligence/src/prioritize.ts:11-23`)
  uses a documented formula (`priorityScore = SEVERITY_WEIGHT[severity] +
confidence * 10`) explicitly commented "never an opaque score."
  `priorityReason` stores a human-readable trigger/observed-value/
  financial-context on every finding. Every one of the 9 deterministic
  capabilities (registry.ts, as of ticket-risk, 2026-08-21) uses
  `CONFIDENCE_DETERMINISTIC_RULE = 0.9`, a fixed constant — same inputs
  always produce the same output.
- **affectedFiles**: n/a
- **fix**: None needed.
- **testsAdded**: None needed.
- **remainingRisk**: The one agent-generated finding type
  (`agent.investigation`) derives confidence from a real Claude call via
  `combineSpecialistConfidence`, which is not guaranteed bit-identical
  run-to-run, and no run stores a "previous priorityScore" for
  before/after comparison — a real but low-severity gap given this is the
  only non-deterministic finding type in the system today.

---

### 15. Role Relevance

- **status**: NOT_PRESENT
- **severity**: low
- **actualEvidence**: `getTodaysAttention` (`todays-attention.ts:59-118`)
  takes only `session` and `now`, computing one `attention` object for the
  whole organization — no role parameter anywhere in `prioritizeFindings`,
  `composeCards`, or `page.tsx`. The only "role" concept in the codebase
  is the auth/permission level on `memberships`
  (`owner`/`admin`/`member`/`viewer`) — an authorization tier, not a
  business-function role (CEO/Finance/Sales/Delivery).
- **affectedFiles/Services/UI**: n/a — genuinely unbuilt
- **rootCause**: Originally, no multi-member/invite flow existed at all
  (confirmed independently by `docs/product-vision-backlog.md`'s Prompt
  29 finding: "no `inviteMember`-style function exists"), so every real
  organization had exactly one member — no second real person to rank
  differently for. **Update (Phase 3, implementation roadmap,
  2026-08-21)**: a real invite flow now exists
  (`packages/persistence/src/invites.ts`, `apps/web/app/_actions/invite-
member.ts`, `apps/web/app/profile/team-panel.tsx`) — an organization
  can have more than one real, real-role member today. The prerequisite
  this issue was blocked on is resolved; role-aware ranking logic itself
  is still genuinely unbuilt.
- **fix**: Not implemented — `getTodaysAttention`/`prioritizeFindings`/
  `composeCards` still compute one `attention` object for the whole
  organization with no role parameter. Building that ranking logic is
  now unblocked but remains its own scoped future phase, not bundled
  into Phase 3.
- **testsAdded**: None (role-aware ranking itself, still unbuilt). Phase
  3 added 9 live-database tests for the invite flow itself
  (`packages/persistence/tests/invites.test.ts`) and 3 for the resulting
  member roster (`packages/persistence/tests/membership.test.ts`).
- **remainingRisk**: Low — real multi-member orgs exist now, but nothing
  in the product yet treats members differently by role, so nothing is
  silently wrong; the gap is an unbuilt feature, not a latent bug.

---

### 16. Ownership Resolution

- **status**: FIXED
- **severity**: low
- **actualEvidence**: ADR 0039 already extended real, deterministic,
  exact-match ownership resolution (`resolveMembershipIdByDisplayName`) to
  Asana tasks (`tasks.owner_membership_id`, real column, really populated
  at ingest). This audit's first pass mis-scoped the still-open HubSpot
  half as needing a new HubSpot Owners API integration — re-tracing the
  actual data flow found that was wrong: the mapper
  (`hubspot/mapper.ts`) already calls `fetchHubSpotOwners` and resolves
  `hubspot_owner_id` into a real display name (`lead.owner.name`) — that
  name was just never passed through to `ingestHubSpotDeal`, which
  hardcoded `owner_membership_id` to `null` regardless
  (`packages/persistence/src/hubspot-sync.ts`, confirmed by direct read).
  The real gap was one dropped field on an internal call, not a missing
  external integration.
- **affectedFiles**: `packages/persistence/src/hubspot-sync.ts`,
  `apps/web/app/_lib/sync-hubspot.ts`
- **affectedServices**: HubSpot lead ownership
- **affectedUI**: `/` command center (ownership-gap findings can now
  actually fire for HubSpot leads, not just Asana tasks)
- **reproduction (closed)**: Previously, syncing any HubSpot deal always
  produced a lead with `owner: null`, regardless of who actually owned the
  deal in HubSpot.
- **rootCause**: `IngestSourceLeadInput` (`hubspot-sync.ts`) had no
  `ownerName` field, and the one real call site
  (`apps/web/app/_lib/sync-hubspot.ts`) never passed `lead.owner?.name`
  through despite it already being available on the parsed record.
- **fix**: Added `ownerName: string | null` to `IngestSourceLeadInput`;
  `ingestHubSpotDeal` now calls the same
  `resolveMembershipIdByDisplayName` Asana already uses (exact,
  case-insensitive match — no fuzzy matching, consistent with ADR 0039)
  before the insert, replacing the hardcoded `null`. The one real caller
  now passes `lead.owner?.name ?? null` through.
- **testsAdded**: `packages/persistence/tests/hubspot-sync.test.ts` — 2
  new tests mirroring `tasks.test.ts`'s exact pattern: a real membership
  whose display name matches `ownerName` resolves to a real
  `owner_membership_id`; a non-matching name leaves it `null`.
  **Live-verified against the real dev database** — both new tests ran
  and passed against the actual Supabase dev project (327/327 persistence
  tests green), not mocked.
- **remainingRisk**: None material for HubSpot specifically. Exact-match
  resolution still means an org member whose HubSpot owner profile name
  differs from their SignalDesk display name won't resolve — the same
  known limitation ADR 0039 already accepted for Asana, not a new one.

---

### 17. Waiting-on-Me Deduplication

- **status**: NOT_PRESENT (feature itself unbuilt, so dedup is moot)
- **severity**: none
- **actualEvidence**: `BusinessSnapshot.waitingOnMe`
  (`packages/application/src/business-snapshot.ts:125,229`) is typed but
  hardcoded to always return `[]` — its own comment states "no approval
  workflow exists yet." There is no data source for this field to
  populate from, so there is nothing to deduplicate.
- **fix**: None — matches `docs/product-vision-backlog.md`'s Prompt 25
  (Commitment Intelligence), already correctly marked fully blocked on
  real message-content sync (Gmail/Slack ingestion) that doesn't exist.
- **testsAdded**: None.
- **remainingRisk**: None today; re-check the day Commitment Intelligence
  or any approval workflow ships real data into this field.

---

### 18. External Action Verification

- **status**: PARTIALLY_PRESENT
- **severity**: low
- **actualEvidence**: No formal `PROPOSED→APPROVED→EXECUTING→VERIFYING→
VERIFIED/FAILED` state machine exists as a named type, but the pattern
  is real where it matters most: `billing/checkout/return/page.tsx:21-28`
  explicitly refuses the client-side Stripe redirect as proof and instead
  reads the webhook-synced `organization_subscriptions` row as the source
  of truth, showing "we're finishing setup" until it's real. The Agent
  Fabric's `canExecute: false` invariant means no agent-driven external
  write can happen at all, sidestepping the question entirely for that
  subsystem. One real weaker spot: `email-daily-brief.ts:84-92` +
  `daily-brief-panel.tsx:60-63` shows "Sent to X" the instant Resend's API
  accepts the request — no delivery-confirmation webhook loop exists to
  verify the email actually arrived.
- **affectedFiles**: `apps/web/app/_actions/email-daily-brief.ts`
- **affectedServices**: Daily brief email delivery
- **affectedUI**: `DailyBriefPanel`'s "Sent to X" confirmation
- **reproduction**: Trigger a brief email to an address that bounces —
  the UI still shows "Sent to X" since only Resend's synchronous accept
  response is checked.
- **rootCause**: Resend's async delivery-status webhooks are never
  configured or consumed by this app.
- **fix**: Not implemented — wiring a real delivery-confirmation loop
  needs a new webhook receiver and a state field on the brief record, a
  real but non-trivial addition outside this pass's bounded scope.
- **testsAdded**: None.
- **remainingRisk**: Low-severity, cosmetic-adjacent — a bounced email
  shows a falsely confident "Sent" label, but no business data or money is
  at stake.

---

### 19. Action Idempotency

- **status**: PARTIALLY_FIXED
- **severity**: high
- **actualEvidence**: The dominant pattern is real and strong:
  `internal_tasks` has `unique(organization_id, idempotency_key)` +
  `ON CONFLICT DO NOTHING`, used identically by human card actions and
  agent-approved actions. The one real gap, self-acknowledged in the
  code's own doc comment (`subscriptions.ts:178-183`): `start-checkout.ts`
  checks for an existing subscription, then calls Stripe to create a real
  customer+subscription, and only _after_ that tries the local insert —
  no lock or Stripe idempotency key covers the gap between the check and
  the Stripe calls. Two concurrent submits (double-click, a retried
  request) could both pass the check and each create a **live, billed
  Stripe subscription**; only one local insert can win
  (`organization_subscriptions_org_unique`), leaving the loser's Stripe
  subscription orphaned with no local record — a real financial-integrity
  risk, correctly the highest severity finding in this audit.
- **affectedFiles**: `apps/web/app/_actions/start-checkout.ts`
- **affectedServices**: Self-serve billing checkout
- **affectedUI**: `/pricing`, `/billing/checkout/[planKey]`
- **reproduction**: Double-click "Start subscription," or have a network
  retry resend the same form submission — both requests can pass the
  existing-subscription check before either has written its result.
- **rootCause**: Check-then-act race between `getOrganizationSubscription`
  and the later `createOrganizationSubscription`/
  `resurrectOrganizationSubscription` insert, with real Stripe API calls
  (an external side effect) in between.
- **fix**: Added an in-memory, single-process advisory lock
  (`inFlightCheckouts: Set<string>`, keyed by `organizationId`) — a second
  concurrent `startCheckoutAction` call for the same organization is now
  rejected immediately ("A checkout is already in progress") before ever
  reaching Stripe. Released in a `finally` block so it can't leak on any
  exit path (error, success, or the trial-flow redirect that already runs
  outside the wrapped `try`). Explicitly disclosed as the same kind of
  stopgap as the existing `rate-limit.ts` module (module memory, resets on
  restart, not shared across instances) rather than overclaiming
  distributed-lock robustness it doesn't have.
- **testsAdded**: None — this app has no existing unit-test pattern for
  Server Actions (confirmed: zero `.test.ts` files exist under
  `apps/web/app/_actions/`; this repo verifies Server Actions via
  typecheck/build plus live Playwright, not mocked unit tests). Verified
  by `pnpm -r typecheck` and `pnpm --filter @signaldesk/web build`, both
  clean. **Not live-verified against a true concurrent race** (would need
  two genuinely simultaneous requests against a real signed-up account
  with Stripe test-mode credentials) — disclosed honestly rather than
  claimed as proven under load.
- **remainingRisk**: The lock is single-process/in-memory — a
  multi-instance deployment would need a real distributed lock or a
  Stripe idempotency key instead; correctly disclosed as the same known
  limitation the rest of this app's rate-limiting already carries, not a
  new one introduced here.

---

### 20. Agent Containment

- **status**: PARTIALLY_FIXED
- **severity**: medium
- **actualEvidence**: Real containment already exists: the
  `AGENT_FABRIC_ENABLED` kill switch, a 3-per-5-min rate limit, exactly 2
  static agents with no recursive delegation, `MAX_FINDINGS_PER_TASK = 20`,
  `MAX_OUTPUT_TOKENS = 1_024`, and a 5-minute capability-grant TTL. The
  real gap: `AgentCard.timeBudgetMs` (30s finance / 5s delivery,
  `agent-card.ts:29,45`, schema-validated as a positive int) was declared
  and displayed as metadata but never wired into an actual timeout — a
  hung Anthropic API call had no enforced cutoff.
- **affectedFiles**: `packages/application/src/ai/ai-provider.ts`,
  `packages/application/src/ai/claude-provider.ts`,
  `apps/web/app/_lib/agent-gateway.ts`
- **affectedServices**: Agent Fabric specialist dispatch
- **affectedUI**: `/agents` (a hung investigation would previously have no
  bound on how long a "running" collaboration could stay open)
- **reproduction**: A Claude API call that hangs (network stall, provider
  outage) previously had no timeout — `client.messages.create()` used the
  SDK's own default with no per-call override tied to the declared budget.
- **rootCause**: `GenerateStructuredInput` never carried the calling
  agent's `timeBudgetMs`, so `claude-provider.ts` had no value to apply as
  a request timeout even though the SDK supports one
  (`internal/request-options.d.ts:82`).
- **fix**: `GenerateStructuredInput` now carries an optional `timeoutMs`;
  `agent-gateway.ts` passes `agent.timeBudgetMs` through on every
  dispatch; `claude-provider.ts` passes it as the Anthropic SDK's own
  `{ timeout }` request option and wraps a resulting
  `Anthropic.APIConnectionTimeoutError` into a clear, catchable error
  naming the exceeded budget. The deterministic provider is unaffected
  (makes no network call, ignores the new optional field).
- **testsAdded**: `claude-provider.test.ts` — three new tests: the
  timeout is passed through as `{ timeout: 5000 }` when `timeoutMs` is
  given; omitted (`{}`) when not; a simulated
  `APIConnectionTimeoutError` is wrapped into a clear error naming the
  budget. Two pre-existing tests updated for the now-two-argument
  `messages.create(params, options)` call shape.
- **remainingRisk**: **Not live-verified against a real Claude call** —
  `ANTHROPIC_API_KEY` is unconfigured in this environment (confirmed via
  `.env.local`), so the Agent Fabric runs on the deterministic provider
  locally; this fix is proven by mocked unit tests and typecheck only.
  There is still no cumulative per-investigation cost/time budget beyond
  the per-call timeout and the crude request-count rate limit.

---

### 21. Prompt Injection from Connector Data

- **status**: ALREADY_HANDLED
- **severity**: none
- **actualEvidence**: `docs/adr/0044-prompt-injection-audit-and-boundary.md`
  is a dated, real audit of exactly this question. `claude-provider.ts`'s
  `SYSTEM_PROMPT` names an explicit `<untrusted_business_data>` boundary
  and instructs the model to ignore embedded instructions;
  `neutralizeDelimiterEscapes` strips `<` to prevent forging a fake
  closing tag. Two adversarial tests already cover both the boundary and
  the escape-neutralization (`claude-provider.test.ts:194,222`, both still
  passing after this session's changes). `canExecute: false` caps blast
  radius independently of any of this. Caveat confirmed by direct search:
  no Slack/Gmail/document content is ingested into any prompt today — only
  short CRM/PM/accounting name fields flow in, so the live attack surface
  is narrower than the risk class's framing implies, and the next
  connector to ingest message content must extend this same pattern.
  **Re-verified (Phase 4b, implementation roadmap, 2026-08-21)**: Gmail
  is now that connector — `messageFollowUpIntelligence`'s findings build
  `title`/`summary` from an untrusted subject line and snippet, and
  `runAgentInvestigationAction` always re-derives the _full_ current
  finding set, so this content automatically reaches the same
  `<untrusted_business_data>` boundary the moment a user triggers
  "investigate risk." The existing generic mechanism was never written
  to special-case a connector, so it needed no code change — a new
  adversarial test (`claude-provider.test.ts`, "neutralizes an attempted
  delimiter-escape inside a real Gmail-derived finding") proves the
  boundary holds for this first real case, passing. `body_preview` (the
  truncated full message text) never reaches this path at all, only
  `snippet` — see ADR 0050.
  **Re-verified again (Zendesk support-ticket connector, ADR 0054,
  2026-08-21)**: exactly the trigger this entry's own previous update
  named in advance ("a support-ticket connector"). `ticketRiskIntelligence`'s
  findings build `title`/`summary` from an untrusted Zendesk ticket
  subject line, reaching the same boundary the same way. A third
  adversarial test (`claude-provider.test.ts`, "neutralizes an attempted
  delimiter-escape inside a real Zendesk-derived finding") confirms the
  boundary holds for this second real connector-derived case too — again
  no code change needed, since the mechanism is genuinely generic.
- **affectedFiles/Services/UI**: n/a
- **fix**: None needed.
- **testsAdded**: One new adversarial test added Phase 4b (Gmail); a
  second added with the Zendesk connector (see above); none else needed
  (already covered).
- **remainingRisk**: None today. The trigger this entry named has now
  fired twice (Gmail, Zendesk) and the boundary held both times;
  re-verify again the day a _third_ message/document-content connector
  (Slack, Intercom, a documents connector) starts feeding real content
  into a prompt.

---

### 22. Business Memory Poisoning

- **status**: NOT_PRESENT
- **severity**: none
- **actualEvidence**: `docs/proactive-ai-direction.md:136-138` states
  plainly "No storage or consumption path exists today" for Business
  Memory. Zero implementation found anywhere in the codebase.
  `IntelligenceFinding` is recomputed fresh from live data on every read —
  nothing persists an AI inference as reusable "truth." There is nothing
  for a poisoned inference to poison.
- **fix**: None — matches `docs/product-vision-backlog.md`'s Prompt 15,
  already deliberately, reasonedly not built (checked twice against every
  table added this session, per that entry's own "Reconfirmed" note).
- **testsAdded**: None.
- **remainingRisk**: None today; the correct trigger to re-open this is
  "Business Memory gets built," not this audit pass.

---

### 23. Live UI Noise

- **status**: RE-OPENED then RESOLVED (updated 2026-08-21 — this entry's
  own text said to re-open it the day a live/push transport shipped;
  Phase 2, implementation roadmap, did that the same day)
- **severity**: none
- **actualEvidence (original, now superseded)**: Neither
  `command-center-board.tsx` nor `daily-brief-panel.tsx` had any polling/
  live-update mechanism at the time this issue was first audited.
- **actualEvidence (current)**: `useBusinessSnapshot` (`use-business-snapshot.ts`)
  now accepts a real `pollIntervalMs` option; `command-center-board.tsx`
  passes 45,000 and re-renders from freshly-polled cards without a manual
  refresh, live-verified via Playwright (a real poll tick landing at
  t≈46.2s, confirmed against `internal_cost_events` that polling adds no
  AI-cost rows). `daily-brief-panel.tsx` still has no polling of its own
  — this class's fix was scoped to the command center, not every panel.
  Re-checked the specific risk this issue names (indiscriminate reflow
  from a live channel causing noisy/jarring UI updates): background polls
  never flip `isLoading` (no flicker), and cards only swap once a poll
  actually lands with new data — the risk this issue anticipated was
  designed around when the feature was built, not left unaddressed.
- **fix**: None needed for this issue specifically — Phase 2's own design
  already accounted for the noise risk this issue flagged in advance.
- **testsAdded**: See Phase 2's own live-Playwright verification
  (roadmap plan file) — no new test added directly for this re-check.
- **remainingRisk**: None. `daily-brief-panel.tsx` remaining unpolled is a
  scope choice, not a regression of this issue.

---

### 24. One-Page Product Integrity

- **status**: ALREADY_HANDLED
- **severity**: none (one named, already-tracked finding, not new)
- **actualEvidence**: `docs/adr/0048-product-integrity-surface-audit.md`
  already ran a file-tree-derived version of this exact audit this
  session, classifying all 14 real `page.tsx` routes against the
  `DAILY_COMMAND_CENTER`/`CONTEXTUAL_DETAIL`/`ADMIN_CONFIGURATION`/
  `DEVELOPER_OPERATOR` taxonomy. `/` remains the sole command center. Its
  one real finding — `/integrations` has absorbed more capability
  (Business Data Map, CSV import, industry recommendations, Data Quality
  panel, time-to-first-sync notice) than its original scope, though each
  addition was independently justified — is explicitly recorded there as
  a named, not-yet-acted-on risk for whoever next touches that page, not
  something this pass re-litigates.
- **fix**: None — already correctly audited and disclosed.
- **testsAdded**: None needed.
- **remainingRisk**: The already-named `/integrations` sprawl finding
  stands, unchanged by this pass.

---

### 25. Evaluation/Regression Coverage

- **status**: PARTIALLY_PRESENT
- **severity**: low
- **actualEvidence**: No pre-ship quality/accuracy regression harness
  exists for the Intelligence Core or Agent Fabric — correctness is
  verified only via ordinary deterministic unit tests on fixed input/
  output pairs. `card_feedback` (ADR 0032) is a real, live, count-based
  production feedback signal (`useful`/`not_relevant` reactions), not a
  benchmark. This matches `docs/product-vision-backlog.md`'s Prompt 13
  reality check exactly: building a full Evaluation Lab (versioned
  datasets, Champion/Challenger, regression gates) against near-zero real
  AI production volume would be speculative infrastructure with nothing
  real to evaluate yet.
- **fix**: None — already correctly reasoned about; the right trigger for
  building this is real AI usage volume, not a fixed pass count.
- **testsAdded**: None.
- **remainingRisk**: Real and acknowledged — an AI-quality regression
  (e.g. a prompt change that quietly makes claims less grounded) would not
  be caught by anything today except a human review of the diff. Correctly
  the honest state to be in given current usage volume, not a gap this
  pass could responsibly close by inventing infrastructure ahead of real
  data.

---

## Additional P0 spot-checks (fourth pass) — two dictionary items not in the original 25, both real

A later pass ("SignalDesk Feature Dictionary") explicitly named "OAuth
state/PKCE" and "encrypted credential references" as things to verify.
Neither was a named issue class in the original 25, but both are P0-tier
(security) per that pass's own priority order, so they were checked
directly against the code rather than assumed either way:

- **OAuth CSRF `state` + PKCE**: real. `apps/web/app/_lib/oauth-state.ts`
  — a single-use, httpOnly, `sameSite: "lax"`, 10-minute-expiring
  server-stored nonce, verified and always cleared on the callback side
  (`consumeOAuthState`), generalized across every OAuth connector by
  provider name. Real PKCE (`issuePkceVerifier`/`consumePkceVerifier`)
  for Microsoft's connectors specifically. `connect-hubspot.ts`'s own doc
  comment confirms the design intent matches the implementation.
  `ALREADY_HANDLED`, no gap found.
- **Encrypted credential references**: real. Every OAuth token (access +
  refresh) is stored via Supabase Vault
  (`packages/persistence/drizzle/0011_hubspot_token_vault.sql`,
  generalized to every connector in migration 0019) — the encryption key
  lives outside the database entirely, so a database dump alone cannot
  decrypt a token. `security definer` functions with `search_path = ''`,
  RLS-backed tenant checks before any vault access, revoked from
  `public`/`anon`/`authenticated`, granted only to `app_runtime`.
  `ALREADY_HANDLED`, no gap found.

See `docs/feature-dictionary-coverage.md` for the full section-by-section
reality check against that pass's much larger (~500-item) spec — most of
it is real product vision with no implementation, deliberately so per
reasoning already recorded in `docs/product-vision-backlog.md`, not a gap
this pass could or should close by building speculatively.

---

## What was actually fixed, across all passes, in one place

| #   | Issue                                                                                                                                    | File(s)                                                                                                                 | Verified by                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 4   | Stripe billing client had zero automatic retries                                                                                         | `stripe-billing/client.ts`                                                                                              | New unit test, full suite green                                                                                     |
| 5   | HubSpot mapper silently defaulted a missing `dealname` with no drift signal                                                              | `hubspot/mapper.ts`, `sync-hubspot.ts` (×3 call sites)                                                                  | 3 new unit tests, full suite green; not live-verified (needs a real HubSpot OAuth login)                            |
| 7   | `invoice-payment-scenario.ts` duplicated the canonical overdue-sum arithmetic                                                            | `packages/semantics/src/compute.ts`, `.../index.ts`, `invoice-payment-scenario.ts`, `packages/application/package.json` | Existing test suite (unchanged) still green, proving identical output                                               |
| 9   | Reconciled findings reported the wrong (non-worst) freshness                                                                             | `agent-result-reconciler.ts`                                                                                            | New unit test, full suite green                                                                                     |
| 12  | No signal for how many AI investigations were declined vs. triggered                                                                     | `run-agent-investigation.ts`                                                                                            | **Live-verified** — triggered via a real guest session, confirmed the real audit-event row in the live dev database |
| 16  | HubSpot leads were permanently unowned — a resolved owner name was already computed by the mapper but silently dropped before the insert | `hubspot-sync.ts` (persistence), `sync-hubspot.ts` (apps/web)                                                           | **Live-verified** — 2 new tests ran against the real dev database, 327/327 persistence tests green                  |
| 19  | Checkout double-submit race could orphan a live Stripe subscription                                                                      | `start-checkout.ts`                                                                                                     | typecheck + production build (no unit-test pattern exists for Server Actions in this repo)                          |
| 20  | Agent time budget was declared but never enforced                                                                                        | `ai-provider.ts`, `claude-provider.ts`, `agent-gateway.ts`                                                              | 3 new unit tests, full suite green; **not live-verified — no `ANTHROPIC_API_KEY` configured locally**               |

Final full-suite run (fourth pass, with `DATABASE_URL` loaded so
`persistence`'s live-database tests actually ran rather than skipping):
`pnpm -r typecheck` clean across all 12 packages + apps/web; `pnpm -r test`
— **925/925 tests passed, zero skipped** (44 domain, 17 csv-import, 6
data-quality, 7 dependencies, 131 schemas, 180 integrations, 327
persistence — against the real Supabase dev project, 29 semantics, 14
goals, 53 intelligence, 117 application); `pnpm --filter @signaldesk/web
build` clean, all 51 routes generated.

See `ISSUES-REMAINING.md` for the full P0/P1/P2 sort of everything still
left open, and `docs/feature-dictionary-coverage.md` for how this audit's
25 risk classes map onto the much larger Feature Dictionary spec.
