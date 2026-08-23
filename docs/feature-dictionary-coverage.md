# Feature Dictionary — Real Coverage Report

- Status: Evidence-based gap analysis against a pasted 55-section, ~500-item
  "SignalDesk Feature Dictionary" product specification. This is not a
  build plan and nothing here was implemented as part of writing it.
- Date: 2026-08-21

## Why this document exists instead of 500 implementations

The Feature Dictionary describes a mature, multi-year enterprise platform:
a mobile/PWA product, a certified Connector Marketplace, a full A2A/MCP
multi-agent protocol gateway, a Business Memory system, Signal Fusion, an
Evaluation Laboratory with Champion/Challenger testing, OpenTelemetry
distributed tracing, and 30 Industry Packs, among hundreds of other named
engines. Marking most of this `NOT_IMPLEMENTED` and quietly moving on
would waste the document; claiming any of it is "done" without it being
real would violate this repository's own non-negotiable rule (`CLAUDE.md`):
_"Never mark a capability as working, tested, or production-ready unless
it actually is."_ This report is the honest middle path the codebase's own
history already established — `docs/product-vision-backlog.md` ran this
exact exercise repeatedly across 2026-08-19 and 2026-08-20 (its own
"reality check" sections cover the large majority of what this dictionary
names), and `README.md`'s capability-snapshot table already tracks current
truth continuously. This document is a fresh cross-reference against the
dictionary's own section structure, not a re-derivation from scratch.

**Headline finding**: the real, shipped product is the daily-operating
core (Section 1's Command Center, minus most of its enumerated sub-
features) plus a genuinely deep but narrow slice of financial/delivery
intelligence, a real Connector Framework for one vertical (professional
services), a real but two-specialist Agent Fabric, and real governance
primitives (RLS, prompt-injection boundary, audit trail, Trust Center,
cost instrumentation). The other roughly two-thirds of this dictionary —
Business Memory, Signal Fusion, Decision Intelligence, Scenario Simulation
beyond one type, Commitment Intelligence, most Financial/Operational
sub-engines, the Event Fabric, multi-agent patterns beyond
`PARALLEL_SPECIALISTS`, A2A/MCP, Evaluation Lab, OpenTelemetry, Control
Plane beyond allow/deny, Extension Marketplace, 29 of 30 Industry
families, mobile/PWA, and most of the Interactive Visual System — is
real product vision with no implementation, most of it _deliberately_ so,
per already-recorded reasoning (see each section below).

**Status legend**: `REAL` (shipped, tested, in the real data path) /
`PARTIAL` (a genuine narrow slice exists, most of the named sub-features
don't) / `NOT_BUILT` (nothing exists) / `BLOCKED` (not built, and cannot
be built yet because a named prerequisite doesn't exist either).

---

## 1. Core SignalDesk Experience — **PARTIAL**

Real: the one-page command center (`apps/web/app/page.tsx`) combining
findings, business metrics, goals, and the daily brief; Universal Business
Search exists as a real deterministic filter (`docs/adr/0040`); a Command
Bar (not a full palette) parses a few deterministic phrases plus the one
real AI trigger. `WhyDisclosure` is a real, working Evidence Explorer for
every metric and finding. **Not built**: Business Pulse as a named
composite widget, "What Came In"/"What's Stuck" as their own labeled
surfaces (the underlying signals exist as separate cards, not unified
under these names), Waiting on Me/Us/Them (the one real `waitingOnMe`
field is hardcoded `[]` — no approval workflow exists), Focus Mode,
Contextual Action Tray as a distinct component, Progressive Signal
Inspection as a formal headline→evidence→history pipeline (evidence
exists, history doesn't), Command Palette (keyboard-driven entity/action
search).

## 2. Executive Intelligence — **PARTIAL**

Real: Daily Brief (ADR 0016) and "Since You Left" (ADR 0025), both
deterministic-assembly, both persisted and honestly labeled
`generatedBy: "deterministic-assembly"`. **Not built**: End-of-Day Brief,
Weekly Operating Review, and all five Role Views (Executive/Operations/
Finance/Sales/Delivery) — every user sees the identical ranked list
regardless of role. A real multi-member/invite system now exists (Phase
3, implementation roadmap, 2026-08-21 — see Section 41), so there can be
a second real person to differentiate for; the role-aware ranking logic
itself is still unbuilt, its own scoped future phase.

## 3. Business Graph — **PARTIAL**

Real canonical entities: `leads`, `invoices`, `tasks`, `payments` — each
via the real `source_records` → normalized-entity provenance pattern
(ADR 0003/0014). Ownership resolution (this session) now correctly
resolves for both Asana tasks and HubSpot leads. **Not built**: Customer/
Project/Opportunity/Contract as first-class objects (`Customer` doesn't
exist as an entity — a lead's `companyName` is a free-text string), a
Temporal Business Graph (no snapshot/versioning of any entity), Entity
Resolution beyond one narrow deterministic detector
(`detectInvoiceLeadNameDuplicates`, ADR 0042 — exact-string match only,
no merge action, no reversibility since nothing ever merges), the
"one ACME across six systems" cross-system identity example in the
dictionary itself is aspirational — this app has no cross-system entity
linking beyond that one detector.

## 4. Business Semantic Layer — **PARTIAL**

Real: `@signaldesk/semantics` (ADR 0034) — 5 real `MetricDefinition`s
(AR, overdue exposure, pipeline value, cash collected, task backlog),
each with real formula/lineage, per-currency grouping that never blends
currencies (currency normalization is real; FX conversion is not).
Source-authority conflict detection exists and is tested
(`detectMetricAuthorityConflicts`) but can't fire in production yet
(every capability class has exactly one connector today). **Not built**:
Revenue/Margin/Capacity/DSO/SLA metrics (no connector syncs the data they
need), metric-definition version history (only the current formula is
tracked), timezone normalization as its own subsystem (organization-level
timezone exists via Business Profile, ADR 0011, not a general
normalization engine).

## 5. Data Quality — **PARTIAL**

Real: `@signaldesk/data-quality`'s one detector (ADR 0042); connector
`degraded` status driven by real sync-validation failures (ADR 0043,
this session extended it to also flag a HubSpot deal with no usable
name — see `docs/25-issue-audit.md` issue 5); Business Data Map / Business
Coverage by connector purpose (ADR 0015) is real and working. **Not
built**: a general Data Freshness Engine (freshness is computed narrowly
per-finding, not as its own scored subsystem), Data Conflict Detection
across sources (nothing compares two sources' values for the same fact —
there's only one source per capability class today), a customer-facing
"Data Health" composite score.

## 6. Connector Platform — **PARTIAL**

Real: a genuine Connector Framework (`packages/integrations`,
`ConnectorCapabilityClass`, ADR 0021), 25 cataloged connectors, real OAuth

- real sync for 3 (HubSpot, QuickBooks, Asana), real health/lifecycle
  tracking (Section 7 has the detail). **Not built**: a documented/
  certifiable Connector SDK with formal interfaces (ADR 0021 itself
  explicitly deferred this — "a bigger type system" it warned against
  building without a second real reason to), a Connector Marketplace or
  certification process, a capability registry beyond the static
  `ConnectorCapabilityClass` enum.

## 7. Connector Operations — **PARTIAL**

Real and verified this session: OAuth CSRF `state` (single-use, httpOnly,
expiring, `apps/web/app/_lib/oauth-state.ts`) and real PKCE support for
Microsoft's connectors specifically; credentials encrypted via Supabase
Vault (encryption key outside the database entirely,
`packages/persistence/drizzle/0011_hubspot_token_vault.sql` generalized to
every connector in migration 0019) — genuinely real, not a gap. Real
incremental sync with cursors for all 3 real-sync connectors
(`incrementalSyncImplemented: true`, ADRs 0022/0023/0024); real
provider-specific retry/backoff (`fetchWithRetry`, this session closed the
one gap in it — Stripe billing's client had zero retries, now fixed);
real idempotent connector writes (`ON CONFLICT ... DO NOTHING` on every
real ingest function) and real webhook signature verification (QuickBooks,
Stripe). **Not built**: a Dead-Letter Queue (no queue of any kind exists —
this app is Next.js Server Actions, request/response only, confirmed
repeatedly across this session's audits), reconciliation sync as a
scheduled job (only manual "Sync Now" and webhook-triggered sync exist),
explicit reauthorization workflow (an expired token surfaces as generic
`error`, not a distinct "reconnect" state — `docs/25-issue-audit.md`
issue 2).

## 8. Major Connectors — **PARTIAL**

14 of the listed connectors have real OAuth + real sync or real webhook
receipt (Slack OAuth-only/no sync, HubSpot, Gmail OAuth-only, Outlook
OAuth-only, QuickBooks, Google/Microsoft Calendar OAuth-only, Asana,
Linear OAuth-only, Stripe, Salesforce with real Opportunity sync, Xero
with real invoice sync, Jira with real issue sync, Zendesk with real
ticket sync). The rest of the catalog (Pipedrive, Microsoft Teams,
ClickUp, Monday.com, Teamwork, GitHub, Dropbox, Google Drive, SharePoint,
DocuSign, Intercom) are metadata-only entries (ADR 0021) — real brand
identity and capability classification, zero live OAuth or sync code. A
second real CRM now exists (Salesforce), with real Opportunity→lead sync
(SOQL, `Owner.Name` relationship traversal for owner names in one query,
`LastModifiedDate` incremental filtering). A second real accounting
connector now exists too (Xero, ADR 0052), with real invoice sync
(`If-Modified-Since` header for incremental filtering, a legacy
`/Date(...)/` wire format parsed by a new `parseXeroDate` helper, the
same closed-invoice-detection second pass QuickBooks already
established). A third real projects/tasks connector now exists too
(Jira, ADR 0053, alongside Asana and Linear), with real open-issue sync
across the whole site via JQL (`/rest/api/3/search/jql`, the classic
`/rest/api/3/search` endpoint having been fully removed) — a JSON OAuth
token body instead of form-urlencoded, a mandatory `audience` authorize
parameter, and no programmatic revoke endpoint on Atlassian's side at
all, so disconnect only ever removes the local tokens. The first real
support connector now exists too (Zendesk, ADR 0054) — the first
connector for a genuinely new Business Graph entity (`support_tickets`)
since Gmail's `messages`, with a subdomain that must be known before
OAuth even starts (unlike every discover-the-tenant-after-token-exchange
connector before it) and a real working revoke endpoint, unlike Jira —
no ERP, no field-service, no MSP/MSSP connector exists.

## 9. Universal Data Intake — **PARTIAL**

Real: CSV import for exactly one entity, invoices (`@signaldesk/csv-import`,
ADR 0038) — real RFC4180 parsing, real preview/dry-run, real
`source_records` provenance via a synthetic `csv_import` integration row.
**Not built**: any other entity's CSV import, a generic mapping wizard,
Import Profiles, a generic authenticated webhook intake, database intake.

## 10. Business Event Fabric — **PARTIAL** (updated 2026-08-21, was NOT_BUILT/BLOCKED)

No genuine push/event fabric exists (no webhooks-in beyond QuickBooks'
own real one, no pub/sub, no server-initiated push) — that half of this
section's original claim still holds. What changed: `command-center-board.tsx`
now polls `/api/business/snapshot` every 45 seconds (Phase 2, implementation
roadmap, live-verified via Playwright showing a real poll tick land at
t≈46.2s with zero added AI-cost events per tick), so the command center's
own cards genuinely update without a manual refresh — the specific claim
"zero live/push update mechanism... no polling... at all" is now false
for this one surface. `daily-brief-panel.tsx` still has no polling of its
own. This is real but narrow: client-side interval polling of one
already-computed snapshot, not a real event bus other services could
subscribe to — so Sections 14–16/39/45–47's own deeper needs (real-time
cross-service event propagation, webhook-driven triggers from external
systems, background AI evaluation without a user present) remain blocked
on the genuine event-fabric gap this section originally named, just no
longer on "the UI never updates at all."

## 11. Zero-Prompt AI — **PARTIAL**

Real, and genuinely careful: a materiality pre-filter before any AI call
(`run-agent-investigation.ts` — kill switch, rate limit, "nothing material"
check), real deterministic-first intelligence (9 capabilities, zero model
calls), a real Claude-backed provider as one of two specialists. This
session added real observability for the gate itself (declined-trigger
audit events, live-verified against the dev database). **Not built**: any
of it runs in the background — every real trigger is on-demand via the
command bar, not "zero prompt" in the dictionary's own literal sense of
"the backend watches events and decides on its own" (Section 10's 45s
client-side poll refreshes the UI, it doesn't trigger a background AI
evaluation — that still needs genuine server-initiated/event-driven
infrastructure, not just polling); no multi-model router (exactly one real model
vendor, Claude); no confidence calibration against measured evaluation
outcomes (no evaluation harness exists yet, see Section 38).

## 12. Epistemic Intelligence — **PARTIAL**

Real, in spirit: `IntelligenceFinding.explanation` distinguishes
`trigger`/`observedValue`/`expectedBaseline` from the summary text, and
financial amounts carry an honest `ExposureType`
(`CONFIRMED_AMOUNT`/`AT_RISK_AMOUNT`/`POTENTIAL_EXPOSURE`/..., ADR 0037).
**Not built**: the formal `FACT`/`DERIVED_FACT`/`OBSERVATION`/
`CORRELATION`/`INFERENCE`/`FORECAST`/`SIMULATION`/`RECOMMENDATION` type
vocabulary itself — no finding or claim in the codebase carries an
explicit epistemic-type tag; `docs/proactive-ai-direction.md` names this
exact gap as unbuilt.

## 13. RAG — **PARTIAL, mostly NOT_BUILT**

Real: exactly one retrieval mechanism, plain SQL — confirmed by
repository-wide search this session, zero embedding/vector/full-text/
reranker code anywhere (`docs/25-issue-audit.md` issue 10, correctly
`NOT_PRESENT` since there's nothing to overengineer). Context
authorization is real in spirit (findings passed to a specialist are
already tenant-scoped, already-computed — never raw DB access). **Not
built**: Vector/Hybrid/Graph/Temporal Retrieval, Reranking, a formal
Retrieval Quality Gate (the reconciler's evidence-subset check is real
defense-in-depth but narrower than a quality gate — issue 9), Retrieval
Conflict Detection, Context Compression.

## 14. Signal Engine — **PARTIAL**

Real: `PrioritizedFinding` has real severity, real evidence, real
ownership (when resolvable), a real versioned/explained priority formula
(`priorityReason`, `docs/25-issue-audit.md` issue 14 — `ALREADY_HANDLED`).
**Not built**: Signal as a _persistent, identity-bearing_ entity — every
finding is recomputed fresh on every page render, never stored with its
own lifecycle. The `signals` database table is real DDL with zero
application code ever writing to it — a genuinely orphaned table,
disclosed in README. No `NEW→WATCHING→ACTIVE→ESCALATED→ACKNOWLEDGED→
RESOLVED→REOPENED` lifecycle exists because there's no persisted Signal
to carry a lifecycle state in the first place.

## 15. Signal Fusion — **BLOCKED**

Not built, and cannot be until Section 14's persisted Signal entity
exists — already reasoned through in
`docs/product-vision-backlog.md`'s Prompt 24 as "fully blocked." A real,
concrete instance of the exact problem this section describes exists
today and is disclosed, not hidden: `stuck.ts` and `lead-risk.ts` both
fire on the same untouched-lead condition, producing two cards for one
real situation (`docs/25-issue-audit.md` issue 13) — deliberately not
force-fixed with an ad hoc patch, since that would be exactly the
"parallel engine" this pass's own instructions warn against building
ahead of the real Signal Fusion architecture.

## 16. Attention Intelligence — **PARTIAL**

Real: severity ranking via the versioned priority formula;
`card_feedback` (ADR 0032) is a real, live, count-based adaptive signal
(useful/not-relevant reactions on 5 real card types) — genuinely "Adaptive
Attention," just not yet used to recalibrate ranking. **Not built**:
Role-Aware Attention (no longer blocked on multi-member orgs existing —
see Section 41 — but the ranking logic itself remains unbuilt), Attention
Budget/Smart Escalation (blocked on Section 10's missing event fabric —
nothing to budget or escalate without a live channel).

## 17. Commitment Intelligence — **BLOCKED**

Not built. Blocked on real message-content sync: confirmed this session
(and in `docs/product-vision-backlog.md`'s Prompt 25) that Gmail, Slack,
and Google Calendar connectors store OAuth tokens only — nothing ingests
a message or event into any canonical entity. No free-text AI extraction
pipeline exists either (the real Claude provider only ever interprets
already-structured deterministic findings, never raw message text).

## 18. Goal Intelligence — **PARTIAL**

Real: `@signaldesk/goals` (ADR 0035) — a real `goals` table, real
`evaluateGoal` variance computation against the 5 real Semantic Layer
metrics, a real `goalVarianceIntelligence` capability, a real
`GoalsPanel`. Deliberately never produces `ON_TRACK` (that status
specifically claims a pace/deadline forecast this app has no data to
support — an honest omission, not a bug). **Not built**: Key Results,
Milestones, Goal Dependencies, Goal Forecasting, goal editing/deletion,
any goal needing a metric this app doesn't have (DSO, margin, headcount,
churn).

## 19. Dependency & Root-Cause Intelligence — **PARTIAL**

Real: `@signaldesk/dependencies` (ADR 0036) — exactly one real edge type,
`resolvePaymentInvoiceDependencies` (a payment's linked external invoice
id resolved into a real internal invoice reference, never fuzzy),
already correctly distinguishing confirmed dependency from inferred
causality by only ever producing `CONFIRMED_DEPENDENCY`. **Not built**:
any second relationship type, multi-hop Impact Paths, Root Cause Candidate
ranking — there is exactly one real edge, never a chain to traverse.

## 20. Financial Intelligence — **PARTIAL**

Real: Invoice Risk (`overdue-invoice` capability), Payment Risk
(`payment-received` capability), Pipeline Exposure (`pipeline_value`
metric), and real `ExposureType` tagging across all 5 Semantic Layer
metrics (ADR 0037) — every real number already carries "how calculated"
via the `WhyDisclosure` evidence panel. **Not built**: Revenue
Intelligence, Cash Intelligence beyond `cash_collected_recent`, AR
Intelligence beyond the raw metric, Margin Intelligence, Unbilled
Work/Scope Exposure (no project/contract data synced by any connector).

## 21. Operational Intelligence — **PARTIAL**

Real: Delivery Intelligence (`overdue-task` capability), Ownership-Gap
Detection (`ownershipIntelligence`, now real for both Asana and HubSpot
after this session's fix). **Not built**: Capacity/Utilization/Workload
Intelligence, Client Health, Pipeline Intelligence beyond raw value, SLA/
Deadline Intelligence, Scope-Creep/Client-Silence/Proposal-Stalling
Detection — none of these have a connector supplying the underlying data
(capacity hours, SLA policies, message silence).

## 22. Decision Intelligence — **PARTIAL, mostly NOT_BUILT**

Real: `outcome`/`reviewedAt` columns on `agent_collaborations` (ADR 0027) — a queryable mirror of the one real approve/dismiss flow, not a
persisted `Decision` object. **Not built**: Decision Cards/Options/
Criteria/Assumptions as their own objects, detecting which Signals need a
decision (blocked on Section 14's missing persisted Signal entity).

## 23. Scenario Simulation — **PARTIAL**

Real: exactly one scenario, `simulateInvoicePaymentScenario` (ADR 0031) —
pure, currency-bucketed, labeled `SIMULATION`, no write path exists at all
(so "never mutates production state" is true by construction, not by
convention). **Not built**: Capacity/Deadline/Revenue/Cash/Pipeline
Simulation, any persisted `Scenario` object, baseline-vs-scenario
snapshotting.

## 24. Artifact Engine — **PARTIAL**

Real: exactly one artifact type, the Daily Brief (ADR 0016, plus its
"Since You Left" mode, ADR 0025) — deterministic-assembly, persisted,
honestly labeled. **Not built**: every other named artifact (Client
Brief, Proposal, SOW, Recovery Plan, QBR, Collection Message, Handoff,
Decision Package, Incident Brief).

## 25. Playbook Engine — **NOT_BUILT**

Nothing exists. No playbook object, no execution engine, no governed
workflow beyond the single Safe Action (`create_internal_task`).

## 26. Safe Action Gateway — **PARTIAL**

Real precedent, not the full state machine: `create_internal_task` is one
real, audited, idempotent, tenant-scoped write path — every mutating
action in the app extends this same pattern rather than a second one.
Real "done means verified" precedent exists at the highest-stakes call
site (`billing/checkout/return` refuses the client-side Stripe redirect
and reads the webhook-synced row as truth). This session closed the one
real idempotency gap found (`start-checkout.ts`'s double-submit race,
`docs/25-issue-audit.md` issue 19). **Not built**: the formal `PROPOSED→
POLICY_CHECK→APPROVAL→EXECUTING→VERIFYING→VERIFIED/FAILED` state machine
as named types — today's real write is a direct audited insert, not a
staged pipeline; execution locks/compensation exist only at the one
in-memory checkout guard, not generalized.

## 27. Ownership Engine — **PARTIAL**

Real, deterministic-first, and — after this session — real for two of
the app's three canonical entities: `resolveMembershipIdByDisplayName`
(exact, case-insensitive match) resolves ownership for both Asana tasks
(ADR 0039) and now HubSpot leads (`docs/25-issue-audit.md` issue 16,
fixed and live-verified this session). Explicit `UNOWNED` detection is
real (`ownershipIntelligence` fires specifically when `lead.owner ===
null`). **Not built**: Delegation, backup ownership, team queues,
escalation paths. Their original blocker — no real multi-member/invite
system existing — is resolved (Phase 3, implementation roadmap,
2026-08-21); these remain unbuilt as their own scoped future work, not
because a second real member still can't exist.

## 28. Business Memory — **NOT_BUILT, deliberately**

Nothing persists an AI-derived or organizational fact as reusable truth.
The Organization Business Profile (ADR 0011 — timezone, response-hours
threshold, industry) is the one real, narrow instance of a durable
organizational fact, five fixed columns, not a general `MemoryRecord`
type. Reconfirmed twice in `docs/product-vision-backlog.md` (Prompt 15)
as a deliberate non-build, checked against every table added across two
full sessions of feature work and still correctly not generalized from a
sample size of one.

## 29–30. Industry Operating Models & Industry Packs — **PARTIAL**

Real: `organizations.industry` field (`unspecified` |
`professional_services`, ADR 0019), a minimal `industryProfiles` config
(recommended `ConnectorPurpose`s only, not the full pack interface),
`computeIndustryCoverage` filtering the Business Data Map. Exactly one of
the ~30 listed industry families has any real support, and it's the one
this app's actual connector set happens to match (professional services).
**Not built**: the other 29 families, terminology overrides, per-industry
metrics/Signals/artifacts/playbooks, any `SignalDeskPack` interface.

## 31–35. Agent Fabric, Multi-Agent Patterns, A2A, MCP, AI Provider Layer — **PARTIAL**

Real (ADR 0020, extended this session): `AgentGatewayService` as a real
trust boundary minting time-bounded capability grants and writing
agent-attributed audit events; exactly one collaboration pattern,
`PARALLEL_SPECIALISTS`; 2 real agents (a Claude-backed specialist and a
free deterministic one); `canExecute: false` hard-enforced
(schema-level, not just convention); real result reconciliation
(`reconcileSpecialistResults`, this session fixed a real freshness bug in
it); real containment (kill switch, rate limit, `MAX_FINDINGS_PER_TASK`,
`MAX_OUTPUT_TOKENS`, 5-minute grant TTL, and — this session — a real
enforced per-call timeout matching each agent's declared `timeBudgetMs`,
previously declared but never wired to an actual cutoff). Exactly one
real AI provider, Claude — no OpenAI/Gemini/internal-model adapters.
**Not built**: `SEQUENTIAL_HANDOFF`/`PRIMARY_PLUS_CRITIC`/
`COORDINATOR_SPECIALISTS` patterns, an Agent Directory/Router beyond
static capability matching, literal A2A or MCP wire-protocol compliance
(explicitly named as out of scope in ADR 0020 itself), a second real
model vendor.

## 36. Control Plane — **PARTIAL**

Real: `evaluatePolicy` (`@signaldesk/domain`, ADR 0028) — a real, pure
`PolicyRequest → PolicyDecision` function, but only `ALLOW`/`DENY`, and
only two real callers today (the agent capability check, the connector
entitlement check). **Not built**: `REQUIRE_APPROVAL`/`REQUIRE_REAUTH`/
`REQUIRE_MORE_EVIDENCE`/`DEFER` decision types, a Policy Center UI, policy
versioning or simulation, budget policies.

## 37. Intelligence Economics — **PARTIAL**

Real: `recordInternalCostEvent` wired to the one real cost-incurring call
site (Claude specialist invocations, ADR 0045) — genuinely gated so a
policy-denied or never-attempted call never records a cost. This session
closed the adjacent observability gap (declined-trigger audit events,
live-verified). **Not built**: per-tenant budgets, cost-per-useful-Signal
measurement, a rendered cost dashboard (`getInternalCostSummary` exists
and is tested but unrendered anywhere), model-result caching, batching.

## 38. Evaluation Laboratory — **PARTIAL, mostly NOT_BUILT**

Real: `card_feedback` (ADR 0032) — a genuine, live, count-based useful/
not-relevant signal on 5 real card types, deliberately built as proof a
narrow real evaluation signal can exist before full infrastructure does.
**Not built** (deliberately, per repeated reasoning in
`docs/product-vision-backlog.md`'s Prompt 13): evaluation datasets,
offline/online evals, Champion/Challenger, shadow testing, regression
gates — correctly deferred until real production AI usage volume exists
to evaluate, not built speculatively ahead of it.

## 39–40. Flight Recorder, Observability, OpenTelemetry — **PARTIAL**

Real, un-generalized telemetry: `audit_events` (structured, tenant-scoped,
append-only, written on every connector/billing/task/agent action) and
`sync_jobs` (per-run status/timing/counts/cursor) are real, populated,
tested data — just not correlated into one trace identity and not
OTel-shaped. `source_records.sync_job_id` (ADR 0029) threads one real
correlation id from sync through to ingested records, across all four
real ingest functions. **Not built**: any OpenTelemetry SDK/exporter
(picking a backend is a real vendor decision this repo has explicitly
deferred, same weight as the mobile/React Native choice), a correlation
id threaded past `source_records` into findings, dashboards, an
Investigation Trace UI.

## 41. Security — **REAL, the strongest section in this dictionary**

Forced RLS on every tenant table; RBAC role enum exists at the schema
level (`owner`/`admin`/`member`/`viewer`) and is now real and exercised —
a real invite flow (Phase 3, implementation roadmap, 2026-08-21:
`packages/persistence/src/invites.ts`, live-tested end to end) lets an
org actually reach a second real member with a real non-owner role, not
just the schema-level enum sitting unused; Supabase Vault credential
encryption (key outside the database entirely), verified this session
across every connector, not just HubSpot; real OAuth CSRF `state` and
PKCE (Microsoft connectors), verified this session; real webhook
signature verification (QuickBooks HMAC, Stripe SDK) and real replay
safety via idempotent inserts; a real cross-tenant isolation test exists
per connector ingest function (`"cannot see another organization's
ingested leads"`-style tests, live-database-verified); real audit
logging on every consequential action. **Not built/unverified this
session**: a dedicated IDOR test suite as its own named category
(cross-tenant tests exist per-function, not as a consolidated suite),
automated dependency/secrets scanning as a CI gate (not confirmed either
way this session — worth a direct check before claiming either status).

## 42. AI Security — **REAL for what exists to secure**

Real and audited (ADR 0044, this session's spot-check re-confirmed it
still passes): an explicit `<untrusted_business_data>` prompt boundary,
delimiter-escape neutralization, 2 adversarial tests. `canExecute: false`
is the independent second layer bounding blast radius regardless of what
a model claims. Correctly scoped: no Slack/Gmail/document content is
ingested into any prompt today, so the live attack surface is narrower
than this section implies — the next connector to ingest message content
must extend this same pattern, not invent a new one.

## 43. Trust Center — **REAL**

`/trust` (ADR 0047) is a real, shipped admin-only page: connected
applications, granted scopes, AI provider disclosure, agent governance
summary, audit activity — deliberately links to `/agents` rather than
duplicating its content. One of the more complete sections in this
dictionary relative to what it describes.

## 44. Reliability — **PARTIAL**

Real: `computeConnectorHealth`'s `healthy|degraded|error|unknown` states
(ADR 0021) and `describeConnectorHealth`'s calm status copy (ADR 0026) —
a real, working, narrow first slice of graceful degradation. **Not
built**: circuit breakers, any queue (so nothing to dead-letter or
recover), chaos/failure-injection testing, disaster recovery runbooks.

## 45. Collaborative Operations — **BLOCKED**

Not built. Blocked on the same missing event fabric as Section 10; the
other blocker (no real multi-member orgs existing to collaborate
between) is resolved as of Phase 3 (implementation roadmap,
2026-08-21).

## 46. Intelligent Notifications — **NOT_BUILT**

No notification channel of any kind exists (no push, no in-app toast
system, no email digest beyond the one manual "email this brief" button).
Consistent with the dictionary's own stated goal ("most Signals should
remain on the One Page") — arguably correctly unbuilt rather than a gap.

## 47. Interactive Visual System — **PARTIAL**

Real: a working `CardSeverity` (`info`/`low`/`medium`/`high`/`critical`)
system flowing from schemas through every real finding into card
rendering — genuinely not color-only (severity pairs with text/icons).
**Not built**: a centralized `VisualState` resolver (the mapping is
implicit per-component, not one named function — `docs/product-vision-
backlog.md` names extracting it as a reasonable first real step were this
prioritized), any live-update animation (nothing to animate — see Section
10), Attention Budget, reduced-motion handling for motion that doesn't
exist yet.

## 48. Responsive Cross-Platform Product — **NOT_BUILT**

Confirmed this session: no `manifest.json`, no service worker, no mobile
app of any kind. Next.js App Router web-only. A from-scratch platform
decision (React Native/Expo adoption), explicitly treated by this repo's
own backlog as a decision on the same order as picking a hosting
provider — not a background task.

## 49. Onboarding — **PARTIAL**

Real: industry-based connector recommendations (ADR 0019), a real
time-to-first-sync milestone notice (ADR 0046). **Not built**: the full
funnel as a guided flow, First Verified Action tracking, First
Cross-Connector Signal tracking.

## 50. Extension Marketplace — **NOT_BUILT**

Nothing exists — no package manifest format, no installation/versioning/
certification pipeline. Correctly deferred per ADR 0021's own reasoning
(no third-party publishing until certification exists, and certification
has nothing to certify without a real second connector author yet).

## 51–52. Production Engineering & Readiness States — **PARTIAL, and this is the process this document itself follows**

Real: `README.md`'s capability-snapshot table and Known Limitations
section serve as a continuously-updated, lightweight Launch Matrix;
`IMPLEMENTATION-READINESS.md` (ADR 0030) is a real, evidence-cited launch
matrix using exactly this dictionary's own
`PRODUCTION_READY`/`FUNCTIONAL_NOT_HARDENED`/`PARTIAL`/`MOCKED`/`BLOCKED`/
`NOT_IMPLEMENTED` taxonomy; `docs/25-issue-audit.md` and
`ISSUES-REMAINING.md` (this session) are a real, current, evidence-based
reliability audit; `pnpm test:production` is a real, previously-run smoke
suite (10/10 routes, per ADR 0030). **Not built**: a Feature Wiring
Matrix as its own named artifact (the underlying claim — nothing is
unwired — was independently re-verified fresh this session,
`docs/25-issue-audit.md` issue 1), dedicated race-condition/load/chaos
test suites beyond the one new in-memory-lock fix this session made and
the smoke/load tests ADR 0030 already ran.

## 53. Important Business Risk Detection — **PARTIAL**

8 real deterministic capabilities exist: overdue invoice, overdue task,
untouched lead (×2 framings), ownership gap, payment received, goal
variance, agent investigation. The other ~20 named risk types (Client
Silence, Margin Risk, Capacity Risk, SLA Risk, Scope Creep, ...) have no
connector supplying the data they'd need.

## 54. Next-Best-Action Intelligence — **PARTIAL**

The pipeline is real for the narrow slice that exists: every real finding
already carries what/why/evidence, resolvable ownership feeds "who,"
`recommendedActionTypes` feeds "what should happen," and the one real
Safe Action (`create_internal_task`) is the "execute" step, with the
checkout-lock fix this session strengthening its idempotency guarantee.
**Not built**: "what options exist" (no `DecisionOption` objects, Section
22), "what can SignalDesk prepare" beyond one scenario type (Section 23).

## 55. Product Integrity Engine — **REAL, and enforced this session too**

This is the one section that is a discipline, not a build target — and
it's genuinely the one most demonstrably followed: `docs/adr/0048`
already ran a real One-Page Integrity audit this session's predecessor
work produced, with one concrete named finding (`/integrations` sprawl)
left honestly unresolved rather than hidden. This report is itself an
instance of the same discipline applied to a much larger document.

---

## Bottom line

Of this dictionary's 55 sections, roughly **9 are substantively real**
(3, 4, 6, 7, 18, 19, 27, 41, 43, 55 — noting some overlap), **~30 are
real-but-narrow single slices** (one metric, one scenario, one artifact,
one connector, one relationship type — each a deliberate, reasoned first
step, not an oversight), and **~16 are genuinely not built**, a majority
of those blocked on one remaining missing piece of infrastructure this
repo's own history has identified repeatedly: a live event fabric (blocks
Sections 10, 14–16, 39, 45–47). The other identified blocker — a real
multi-member/invite system, which gated role-aware views and delegation
across Sections 2, 16, 27, 41, 45 — is now resolved (Phase 3,
implementation roadmap, 2026-08-21); the downstream features it was
blocking (role-aware ranking, delegation, team queues) remain unbuilt in
their own right, now unblocked rather than newly complete.

**Update (2026-08-21)**: this bottom line's own top recommendation —
"decide whether to build a live event transport, even simple polling" —
is now out of date. Simple client-side polling shipped in Phase 2
(implementation roadmap): `command-center-board.tsx` refreshes every 45
seconds, live-verified end to end. That specific prerequisite is closed;
see Section 10's own updated entry for what's still genuinely missing
(a real event bus / webhooks-in / server-initiated background triggers,
none of which simple polling provides). Since then, this session also
shipped a fifth Business Graph entity (`support_tickets`, ADR 0054) and
its own intelligence capability, closing part of the Customer Operations
Intelligence backlog entry's own named sequencing — narrow, real
progress, not a re-audit of this dictionary's full 55-section count,
which would need its own dedicated pass to recompute accurately rather
than guessed here.

**If asked to keep going**: the next-highest-leverage real prerequisite
this report's evidence points to is a genuine event/webhook infrastructure
decision (Section 10) — still a product/infrastructure choice for you to
make, not something to default into silently.
