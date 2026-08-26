# SignalDesk — Product Vision Backlog

- Status: Unscoped idea capture, not a roadmap or a commitment. Nothing here is built.
- Date: 2026-08-19

## Why this file exists

Several large product-strategy proposals arrived in quick succession this session (RAG/proactive-AI direction — see `docs/proactive-ai-direction.md`, a 100-item AI-platform spec, a ~30-item product/UX layer, and a ~50-item enterprise-platform layer). Writing a full detailed specification for each one, before any of the previous ones has shipped, would mean permanently falling behind incoming ideas instead of building anything real — the same "quarantined capability" failure mode this repository's own gap-fixing work has spent this session eliminating. This file is a deliberately lightweight index so the ideas aren't lost, without pretending they've been designed.

## Captured themes (unscoped, not built)

**Product/UX layer** (workspace-operability ideas): Morning Operating Mode, Exception Inbox, Work Queue, Command Palette, Universal Search, Generative UI (AI composes from a fixed component set, never arbitrary markup), Timeline (cross-system chronology per entity), Business/Client/Project/Revenue 360 views, Portfolio Mode, Focus/Handoff Mode, Approval Center, Automation Studio (deterministic, admin-authored rules), Playbooks, SLA/Commitment Monitor, Goal Center, Forecast Center, Profitability Intelligence, Resource Planner, Decision Queue/Center, Business Calendar, Impact Center, Mobile/PWA, accessibility, offline resilience, multi-entity/holding-company support, localization.

**Enterprise platform layer**: SSO/SCIM/enterprise identity, parent-child tenant architecture, a public developer API + webhooks + SDKs + service accounts, a connector SDK and certification process, a connector marketplace, custom objects/fields/metrics/signal rules, a semantic metrics layer, warehouse export, real entitlement/metering architecture (distinct from feature flags and permissions), tenant-cohort release rollout (OpenFeature-style), an agent registry with delegated-authority chains and runtime kill controls, configuration diff/rollback, customer sandboxes, automation dry-run mode, a policy simulator, an incident center, customer-facing data health, data residency scaffolding, legal hold, customer data export/portability, scoped support-access grants (no silent impersonation), a capability registry (one canonical "is X implemented, for whom, tested how" index), dependency/critical-path modeling, and a "done means verified" rule for every action (provider-verified / user-confirmed / deterministic-state-confirmed, or else `UNVERIFIED`).

The proposed end-state framing: three products inside one platform — **Command** (daily one-page experience), **Control** (admin governance), **Platform** (API/SDK/marketplace/agents) — with Command staying the only thing most users ever see.

## What's actually true today, for grounding whenever this gets prioritized

Per `README.md`'s capability table (the authoritative, current source — re-check it before resuming this work, since it changes as gaps get fixed): one role (`owner`) exists, no teams/SSO/SCIM; no public API beyond one auth-gated `GET /api/business/snapshot` route; no feature-flag/entitlement/experiment separation (entitlements alone are real, via the billing system); no event fabric, so most of the "runtime policy enforcement" and "webhook" proposals above have no live event stream to attach to yet; no AI model provider, so agent-registry/delegation-chain proposals have no live agent to govern yet.

## Cross-platform / mobile design system (captured 2026-08-19, unscoped)

A proposal to make the repository web + iOS + Android from one codebase: shared design tokens (semantic color/type/spacing), a shared `packages/design-tokens`/`packages/business-components`/`packages/view-models`/`packages/api-client` layer, and Expo/React Native for native apps — while keeping web as the flagship dense/keyboard-first surface and mobile as a triage/approval-first surface ("same Signal, different density"). Sequenced as P0 (tokens + shared primitives + web cleanup) → P1 (mobile shell + core screens) → P2 (push/offline) → P3 (admin surfaces on mobile, only if justified).

**Reality check**: this app today is Next.js App Router web-only, no design-token system, no component library separated from `globals.css`, no mobile app of any kind. This is a from-scratch platform decision (React Native/Expo adoption), not an incremental extension — treat it with the same weight as picking a hosting provider: a real, costly commitment worth its own dedicated decision when the product is ready for it, not a background task alongside everything else.

## State-driven visual design system (captured 2026-08-19, unscoped)

A proposal for one semantic `VisualState` system (`neutral`/`info`/`attention`/`warning`/`high`/`critical`/`success`/`resolved`/`stale`/`degraded`/`approval`/`executing`/`verified`/`failed`) driving color everywhere, resolved centrally from domain state (severity/status/freshness) rather than chosen per-component — with freshness/connector-health kept as a secondary badge, never blended into the primary color; edge accents (left border, icon, badge) rather than full-card fills; motion tokens for enter/escalate/resolve/execute/verify; the same tokens driving web CSS variables and native mobile styling.

**Reality check**: this app's current visual language (`apps/web/app/globals.css`) already has a real severity system — `CardSeverity` (`info`/`low`/`medium`/`high`/`critical`) flows from `packages/schemas` through every real finding into card rendering — but it is not yet the fully centralized "one resolver, everything else consumes tokens" architecture this proposes, and there is no design-token package independent of `globals.css`. A reasonable first real step, if prioritized: extract the existing severity→color mapping already implicit in the card components into one named `resolveVisualState`-style function, before reaching for the full 14-state vocabulary or a token package — extending real code rather than replacing it wholesale.

## Agent Fabric / A2A multi-agent collaboration (captured 2026-08-20, unscoped)

A governed multi-agent architecture: a `SignalDeskAgentGateway` as the mandatory trust boundary for internal/external agents, an `A2AGateway` (Google's Agent2Agent protocol, now under the Linux Foundation) for agent-to-agent task delegation distinct from MCP (tool/context access), an `AgentRouter` selecting eligible agents by declared capability/trust/cost rather than hardcoded provider, capability-scoped delegation grants with attenuation down the chain, an `AgentResultReconciler` merging structured specialist outputs (delivery/finance/capacity/client analysts, potentially different model vendors) into one customer-facing recommendation, an `IndependentCriticService` for high-impact cases, kill switches, and an admin-only `AgentDirectory`/`AgentCollaborationTrace`. Customer-facing UX stays "one AI," not a visible swarm.

**Reality check (superseded 2026-08-19, ADR 0020)**: every piece of this assumes at least one real AI agent already exists to route to, delegate to, or critique. `packages/application/src/ai/ai-provider.ts`'s `AIProvider` interface has exactly one implementation (`createDeterministicProvider`) — no model calls anywhere in this codebase yet. This proposal is architecturally sound as a _later_ layer once (a) a real single-provider `AIProvider` exists (the already-agreed next AI step, on-demand only, behind the command bar) and (b) there's a second real reason to route between providers/specialists at all — today there is exactly one candidate provider (OpenAI) and zero deployed specialist agents, so `AgentRouter`/`AgentResultReconciler`/multi-provider critique have nothing to route or reconcile between yet. Real sequence: single real provider → real usage/evals → only then does "should this route to a second agent" become a real question instead of a speculative one.

**Built anyway, for real, same day (2026-08-19, ADR 0020)**: the user was shown this reality check directly and chose to build the full fabric now rather than wait. The scoped-down real slice: a real Claude-backed `AIProvider` (`claude-provider.ts`) alongside the existing deterministic one as a second, always-available specialist (`AGENT_REGISTRY`); a capability router, a `PARALLEL_SPECIALISTS` coordinator, and a result reconciler (`packages/application/src/agents/`); a real trust boundary (`AgentGatewayService`) minting time-bounded capability grants and writing agent-attributed audit events; three new tenant tables plus a widened `audit_events.actor_kind`; one real end-to-end trigger ("investigate risk" in the command bar) reconciling real overdue-invoice and overdue-task findings into one approval-gated card; two kill switches. Explicitly not built: literal A2A/MCP wire-protocol compliance, a marketplace, A2UI, OpenTelemetry, or a second real model vendor. See ADR 0020 for the full decision record.

**Update (2026-08-24, ADR 0056)**: the fabric's first real external-system write. A fourth capability (`draft_customer_reply`) and a second collaboration pattern (`single_specialist`, one message/one specialist, distinct from the business-wide `PARALLEL_SPECIALISTS` sweep) let a human approve an AI-drafted reply to one unanswered Gmail message, which SignalDesk then actually sends through the tenant's own Gmail connection — the first time an agent-proposed action executes against a system outside this database. `canExecute` stays hard-`false` throughout: the agent only drafts, a separate human-triggered server action (`approveMessageReplyProposalAction`) does the send, reusing the same capability-grant/audit trust boundary (`AgentGatewayService.dispatchMessageDraft`, sharing an extracted `authorizeDispatch` with the original `dispatch`). Still not built: a second connector with a real write action (Outlook has no API client yet), delivery/bounce tracking beyond "Gmail accepted the send," and everything else this entry's "Explicitly not built" list already named. This is the same real, narrow next step the "AI-executed connector actions" reality check below had already flagged as the one concretely scoped gap — now closed for Gmail specifically.

## Zero-Prompt AI / continuous investigation architecture (captured 2026-08-20, unscoped)

A much more detailed version of the RAG/proactive-AI direction (`docs/proactive-ai-direction.md`): "zero prompt" means the customer never types, not that the model gets no instructions — SignalDesk's backend watches business events, decides when investigation is warranted, retrieves bounded context, calls OpenAI (Responses/structured outputs), validates a `SignalInvestigation` schema (signalType, severity, headline, facts/observations/inferences, epistemic labels, owner, financial exposure, recommended actions), and updates the UI — the model is "the reasoner, not the database." Proposes a full pipeline (`CONNECTOR EVENT → BUSINESS EVENT → CANONICAL STATE CHANGE → DETERMINISTIC DETECTION → SIGNAL CANDIDATE → MATERIALITY GATE → RETRIEVAL PLAN → AI INVESTIGATION → QUALITY GATE → ATTENTION → ONE-PAGE UI`), an `InvestigationTriggerPolicy` classifying work into COMPUTE_ONLY/LIGHT_INTERPRETATION/DEEP_INVESTIGATION/HIGH_IMPACT_REVIEW so trivial events never reach a model, a `ModelRouterService`, per-tenant cost budgets, and eval/fine-tuning-later discipline.

**Reality check**: the architecture is sound and explicitly agrees with this session's own build discipline (don't fine-tune first, don't over-spend on trivial events, keep the model as reasoner not memory). What's real today: `packages/application/src/ai/ai-provider.ts`'s `AIProvider` interface is the correct seam for `ModelRouterService` to eventually sit behind — but it has exactly one implementation (`createDeterministicProvider`, template-based, no model calls). What doesn't exist: any event fabric (no background job runner, no webhook-triggered async pipeline — Next.js Server Actions are request/response only), so `ContinuousInvestigationEngine`/`InvestigationTriggerPolicy`/scheduled background investigation cannot run without new infrastructure (a worker/queue) beyond what this app has. Chosen scoped first step (2026-08-20): a real OpenAI-backed `AIProvider` behind the existing on-demand command bar only — no background triggers, no event fabric, no budgets/evals system yet.

## Gaming-inspired interaction language / "executive HUD" (captured 2026-08-20, unscoped)

A live-choreography interaction system borrowing game-UI principles (not aesthetics): four attention intensities (AMBIENT/INFORMATIONAL/ATTENTION/CRITICAL) resolved by an `InteractionResolver` from a `LiveUIEvent` contract; a quiet `BusinessPulse` HUD-style header status (LIVE/UPDATING/NEW_SIGNAL/ATTENTION/DELAYED/OFFLINE); a spatially-stable `PriorityFeed` where signals animate into rank position, escalate, and resolve; `FocusMode` (one issue at a time); progressive-disclosure `SignalInspection`; an `EventCoalescer` batching bursts of related connector events into one UI update; `AttentionBudget` preventing competing animations; the page itself as the notification system (no toast/modal spam — state changes visibly in place) — explicitly avoiding gamification (no points/streaks/confetti) and cyberpunk/neon aesthetics.

**Reality check**: this requires the same missing piece as the zero-prompt architecture above — a live event stream. Today the app has zero live/push updates of any kind: every page is a server-rendered request/response render, cards don't move or animate on new data because nothing pushes new data to an open tab. `LiveUIEvent`/`BusinessPulseController`/`PriorityFeedController` need a real-time transport (WebSocket, SSE, or polling) before any of the choreography has an event to react to. Building the `InteractionResolver`/`MotionTokens`/`AttentionBudget` types now would be exactly the "types nothing reads" problem this session keeps avoiding. Real first step, if prioritized later: a live-data transport for the command center (even simple polling) — everything in this proposal is genuinely downstream of that, not buildable in parallel with it.

**Update (2026-08-21)**: the named "real first step" shipped (Phase 2, implementation roadmap) — `command-center-board.tsx` polls every 45 seconds and swaps in freshly-fetched cards without a manual refresh, live-verified. The specific claim "zero live/push updates of any kind... nothing pushes new data to an open tab" is no longer accurate. What's still genuinely unbuilt, unchanged by that: everything this proposal actually describes beyond "new data arrives" — spatially-stable rank animation, the `BusinessPulse` status indicator, `FocusMode`, `EventCoalescer` batching, `AttentionBudget`. A poll landing and a card list re-rendering in plain DOM order is not the choreography this proposal names; Phase 2 unblocked the data layer this needs, not the interaction layer itself.

## Industry pack framework (captured 2026-08-19, expanded 2026-08-19, unscoped)

A proposal to make vertical expansion (agencies, MSPs, accounting, recruiting, SaaS, field service, e-commerce, construction, property management, legal, healthcare) configuration rather than forking the app: a `SignalDeskPack`/`IndustryPack` format bundling terminology, entity/relationship definitions, metrics, signal rules, artifact templates, playbooks, and recommended connectors per vertical; connectors classified by capability (`CRM`, `ACCOUNTING`, `PSA`, ...) grouped into equivalence classes (e.g. HubSpot/Salesforce/Pipedrive all satisfy `CRM`) so intelligence engines depend on capabilities, not named vendors; a `BusinessCoverageGraph` measuring how well-served each capability is regardless of which specific tool fills it; eventually a marketplace distributing connectors, packs, signal/metric/artifact packs, and playbooks (explicitly deferred — no third-party publishing until certification exists). The expanded version adds a concrete build sequence (Professional Services → MSP → Accounting/Recruiting → B2B SaaS → Field Services → e-commerce/property/construction, with legal and healthcare held back for governance/compliance reasons) and per-vertical object/signal/artifact lists for all 12 verticals.

**Reality check**: `packages/integrations`' real catalog already has the seed of this — `ConnectorPurpose` (pipeline/communication/delivery/calendar/finance/payments) is a capability-style classification, and `computeBusinessCoverageByPurpose` is a real, working, much narrower version of the proposed `BusinessCoverageGraph` (see ADR 0015). What doesn't exist yet: connector _equivalence groups_ (today each connector integration is hand-written against one vendor's API — HubSpot leads and QuickBooks invoices aren't drawn from a shared abstraction a second CRM/accounting connector could also satisfy), and there is exactly one vertical's worth of connectors built at all (HubSpot/QuickBooks/Asana/Slack/Stripe/Gmail/calendars — professional-services-shaped, coincidentally matching the proposal's own recommended first pack). The proposal's own sequencing agrees with this session's build discipline: one real vertical, end-to-end, before any pack abstraction for the other eleven.

**First real slice built (2026-08-19, ADR 0019)**: a real `organizations.industry` field (`unspecified` | `professional_services`, migration 0033), a minimal `industryProfiles` config (not the full `IndustryPack` interface — just recommended `ConnectorPurpose`s), and `computeIndustryCoverage` filtering the existing Business Data Map to what matters for that industry, rendered on `/integrations`. Still not built: equivalence groups, terminology overrides, any second industry, the `SignalDeskPack` interface, or anything marketplace-shaped — all still blocked on the same missing engines noted above.

## Master product/engineering charter (captured 2026-08-20, unscoped)

A single consolidated directive arrived covering nearly every proposal
already logged above, plus several new ones, framed as standing context
for all future work rather than a single build request. The durable
operating-principle portion (honesty discipline, "inspect before building"
discipline, priority ordering when requirements conflict, the
per-feature question checklist) was extracted into a new root `CLAUDE.md`
— it governs how work gets done, not what's built, so it belongs there,
not here. This entry logs the architecture/vision portions that are new or
materially sharper than what's already captured above.

**Net new vs. existing entries**: (1) a full canonical Business Graph
object list (`Organization`, `Team`, `Person`, `Account`, `Opportunity`,
`Contract`, `Milestone`, `Commitment`, `Decision`, `Conversation`,
`Message`, `Playbook`, `Approval`, `Action`, `ConnectorConnection`, `Owner`,
...) — today's real Business Graph has three entities (`leads`, `invoices`,
`tasks`); (2) a `Signal` lifecycle (`NEW → WATCHING → ACTIVE → ESCALATED →
ACKNOWLEDGED → RESOLVED → REOPENED`) and severity ladder
(`INFO → ATTENTION → WARNING → HIGH → CRITICAL`) as a persistent entity
with identity across its own history — today's `PrioritizedFinding` is
recomputed fresh each read, not a persisted, evolving entity; (3) a
`Live Event Fabric` turning connector events into canonical `BusinessEvent`s
with dedup/ordering/replay — same missing piece the Zero-Prompt AI and
gaming-HUD entries above already flag (no event stream of any kind exists
yet); (4) a `Safe Action Gateway` state machine
(`PROPOSED → POLICY_CHECK → APPROVAL_REQUIRED/APPROVED → EXECUTING →
VERIFYING → VERIFIED/FAILED`) — today's one real write
(`create_internal_task`) is a direct audited insert, not a staged pipeline;
(5) a formal connector lifecycle state machine (`AVAILABLE → CONNECTING →
AUTHORIZING → AUTHORIZED → INITIAL_SYNC → SYNCING → HEALTHY`, plus
`DEGRADED`/`RATE_LIMITED`/`REAUTH_REQUIRED`/etc.) — today's `integrations`
table has a much smaller `status` field and a derived, not-persisted
`ConnectorHealth` (ADR 0021); (6) a multi-provider `Model Router` — today
there is exactly one real model integration (Claude, ADR 0020), so there
is nothing to route between yet; (7) an `IMPLEMENTATION-READINESS.md`
tracking file with a `PRODUCTION_READY`/`FUNCTIONAL_NOT_HARDENED`/
`PARTIAL`/`SKELETON`/`MOCKED`/`BLOCKED`/`NOT_IMPLEMENTED` taxonomy —
`README.md`'s capability-snapshot table has served this role informally
since the first commit; whether to formalize a second tracking file is an
open question, not yet decided.

**Reality check**: this is the largest single proposal logged in this
file, and nearly every piece of it depends on infrastructure this repo
doesn't have yet — most centrally, a live event stream (needed by the
Event Fabric, the Signal lifecycle's own state transitions, and the
gaming-HUD interaction layer alike) and a persisted `Signal` entity
(needed before `Approval`/`Action`/`Playbook` objects have anything real
to reference). The existing sequencing logic across every entry in this
file still holds: one real vertical slice at a time, reality-checked
against what's actually built, rather than standing up the full object
model speculatively. No new infrastructure was built from this entry
alone — see the session's concrete follow-up work (QuickBooks connector
completion, connector brand icons) for what was actually shipped
alongside it.

**Expanded to a full "Industry Operating Model" (captured 2026-08-20, unscoped)**: a much larger version of the same idea — a hierarchical `IndustryFamily`/`Industry`/`SubIndustry`/`BusinessModel`/`RevenueModel`/`OperatingModel`/`CompanySize` taxonomy (14 industry families, dozens of sub-industries) where the answer configures terminology, entity/relationship types, metrics, signals, artifacts, playbooks, AI investigation policy, per-org editable thresholds (inactivity/SLA/margin/capacity), an onboarding wizard that "installs" a pack and reports a computed coverage percentage, and an industry-specific composition of the Business Pulse HUD concept. Explicitly frames this as one shared architecture loading different operating models, not one app per vertical.

**Reality check**: this is the same gap as the narrower version above, just wider — every one of `MetricProfile`/`SignalProfile`/`ArtifactProfile`/`PlaybookProfile`/`IndustryPolicyProfile` needs an engine that doesn't exist yet (no config-driven signal/metric/artifact/playbook system; today's 9 intelligence capabilities (registry.ts) are a hardcoded array, and artifacts means one thing: the Daily Brief). The onboarding-wizard "coverage %" and "Business Pulse" concepts also depend on work not yet built (Business Pulse is part of the gaming-HUD proposal above, itself blocked on a live event stream). Real next step if this gets prioritized, unchanged from the narrower version: a second real industry needs real connectors behind it first (e.g. an MSP-shaped connector like ConnectWise/Autotask) — the taxonomy and thresholds are the easy, cheap part; the hard part neither proposal shortcuts is real per-vertical data sources.

## Prompts 11–20: production-agent-system expansion (captured 2026-08-20, unscoped)

Ten more large proposals arrived in one burst, framed explicitly as a
sequence to run "underneath the persistent SignalDesk Master Wrapper...
rather than throwing them all at the repository simultaneously" — the
user's own words, and the same one-slice-at-a-time discipline this file
has applied to every burst before it. Logged here in full so nothing is
lost, each with a reality check against what's actually built today
before any of them gets its own scoped-down real slice.

### Prompt 11 — SignalDesk Control Plane

A unified governance layer (`ControlPlane`, `TenantRuntimePolicy`,
`CapabilityRegistry`, `PolicyDecision`/`PolicyRule`/`PolicyVersion`/
`PolicyEvaluation`, `RuntimeKillSwitch`, `BudgetPolicy`, `ModelPolicy`,
`ConnectorPolicy`, `AgentPolicy`, `ActionPolicy`) that every consequential
operation is evaluated through, with `ALLOW`/`DENY`/`REQUIRE_APPROVAL`/
`REQUIRE_REAUTH`/`REQUIRE_MORE_EVIDENCE`/`DEFER` decisions, tenant spend/
usage limits, emergency kill switches (`DISABLE_AI`,
`DISABLE_CONNECTOR_WRITES`, `READ_ONLY_MODE`, ...), a human-readable
Policy Center, and policy simulation, all versioned and audited.

**Reality check**: real precedents exist, but as narrow, single-purpose
gates hand-written at their own call site — not one shared engine.
`AgentGatewayService` (ADR 0020) already mints time-bounded capability
grants and writes agent-attributed audit events, a real policy boundary
for exactly one subsystem. `AGENT_FABRIC_ENABLED` is a real, working kill
switch. `canAddActiveConnection`/`getEntitlementUsage` (billing) is a
real per-tenant policy gate blocking connector creation past plan limits,
checked before every OAuth exchange. `write-action-safety` is already a
named, required `ConnectorImplementationGate`, just not load-bearing yet
since no connector has a real write. What's entirely missing: any unified
`PolicyRule`/`PolicyVersion` engine, the `REQUIRE_REAUTH`/
`REQUIRE_MORE_EVIDENCE`/`DEFER` decision types, a Policy Center UI, policy
simulation, or budget policies of any kind. Generalizing a shared
`ControlPlane` from a sample size of one enforcement pattern per concern
(agents, billing) would repeat the same premature-abstraction risk this
file's Business Profile and VisualStateResolver entries already avoided
deliberately. First real slice, if prioritized: extract the _existing_
agent capability-grant check and the _existing_ entitlement check into
calls against one shared `evaluatePolicy()` returning `{decision,
reason}` — starting with just `ALLOW`/`DENY` — proving the abstraction
against two real call sites before inventing the other nine policy types
or any UI.

**First real slice built (2026-08-20, ADR 0028)**: `evaluatePolicy`
(`packages/domain/src/index.ts`) — a pure `PolicyRequest → PolicyDecision`
function, `ALLOW`/`DENY` only. Both `canAddActiveConnection`
(`@signaldesk/persistence`) and `AgentGatewayService`'s capability check
(apps/web) now route through it, with zero external behavior change to
either caller. Lives in `@signaldesk/domain` specifically because the two
real callers sit on opposite sides of the dependency graph and that's the
one package both already depend on — closed a real phantom-dependency gap
(apps/web importing `@signaldesk/domain` types transitively without
listing it) in the process. Still not built: `PolicyRule`/`PolicyVersion`
persistence, a Policy Center UI, simulation, budget policies, or any
decision type beyond allow/deny.

### Prompt 12 — Flight Recorder (end-to-end observability)

OpenTelemetry-standardized tracing from connector event through
retrieval, model/agent invocation, Signal creation, approval, action, and
source verification, with one correlation ID threading the whole chain,
metadata/content telemetry separated (content off by default), cost/
latency/token dashboards, an operator-only Investigation Trace UI, and
cost/loop/error alerting.

**Reality check**: `audit_events` (structured, tenant-scoped, append-only,
already written on every connector/billing/task/agent action) and
`sync_jobs` (per-run status/timing/item counts/cursor) are real, tested,
already-populated telemetry — just not correlated into one trace identity
and not OTel-shaped. Agent Fabric's `agent_collaborations`/
`agent_task_results` tables already capture model/capability/confidence/
status per specialist call, a narrow real slice of GenAI-shaped
telemetry. Entirely absent: any OpenTelemetry SDK/exporter, any
correlation ID threaded across a request, dashboards, or the trace UI.
Picking an OTel backend/exporter is itself a vendor decision on the same
order as the mobile/React Native choice this file already treats as its
own dedicated decision — not something to wire in silently alongside
other work. First real step needing no new infrastructure: one
`correlationId` threaded through `sync_jobs` → `source_records` →
intelligence findings for the QuickBooks webhook path specifically (the
one real push-driven trigger with a single clean entry point), before
generalizing to OTel or every other path.

**First real slice built (2026-08-20, ADR 0029)**: `source_records.sync_job_id`
(migration 0039), tenant-scoped FK to `sync_jobs.id` — reusing the run's
own real primary key rather than inventing a parallel correlation-id
string. All four real ingest functions (QuickBooks invoices/payments,
HubSpot deals, Asana tasks) now require it, across all three connectors
with real sync, not scoped to QuickBooks alone as originally suggested —
the same mechanism applied uniformly since it cost no more to generalize
than to special-case. Still not built: OpenTelemetry, any correlation
identity past `source_records` into findings, dashboards, or the
Investigation Trace UI.

### Prompt 13 — SignalDesk Evaluation Lab

A permanent subsystem for evaluating every intelligence change before
rollout: versioned datasets, evaluation dimensions (`SHOULD_SURFACE`,
`SIGNAL_TYPE`, `EVIDENCE_GROUNDING`, `ACTION_SAFETY`, ...), regression
gates, Champion/Challenger configurations, production sampling, and
release gates tied to evaluation evidence.

**Reality check**: nothing exists yet to evaluate. README and every
AI-touching ADR already honestly disclose no tool registry or evaluation
harness exists. The Agent Fabric's one real trigger has produced manual
test runs, not production volume. This file's own Agent Fabric entry
already reasoned through the correct sequencing: single real provider →
real usage → only then does evaluation become a real question instead of
speculative infrastructure. No action recommended until real production
AI usage exists to measure.

**A narrower, different first slice built anyway (2026-08-20, ADR 0033)**:
the AI-quality blocker above is unchanged and still holds. But Prompt
17's `card_feedback` (ADR 0032), built the same session, created a
different real signal — count-based, meaningful from the first row, not
needing volume to calibrate against the way model comparison does.
`summarizeCardFeedback` (`packages/application/src/evaluation/`) is a
real, tested, pure aggregate (useful/not-relevant counts and rate per
card type), surfaced on the existing `/agents` admin page. Not the
proposed Evaluation Lab — no datasets, no Champion/Challenger, no
regression gates — just proof that a narrow, real evaluation signal can
exist before that full infrastructure does.

### Prompt 14 — Business Digital Twin

Extend the Business Graph into a twin representing current, historical,
and bounded hypothetical future state: snapshots/versioning, `Scenario`
objects (assumptions, baseline, proposed changes, calculated effects),
deterministic simulation for known quantities (workload, deadlines, cash
timing), outputs explicitly labeled `SIMULATION`/`FORECAST`, never
mutating production state.

**Reality check**: the real Business Graph (`leads`/`invoices`/`tasks`/
`payments` via `source_records`) already answers "what is true now" with
real provenance; `audit_events`/`sync_jobs` give real append-only history,
so "what changed" is partially answerable today via the audit trail, just
not surfaced as a queryable timeline. Nothing resembling a snapshot/
version mechanism or a `Scenario` object exists anywhere — this is a
large net-new modeling effort, not an extension of something partial. No
credible narrow slice exists without first picking one concrete
deterministic scenario worth building end-to-end, which is a product
decision, not an architecture one.

**First real slice built (2026-08-20, ADR 0031)**: `simulateInvoicePaymentScenario`
(`packages/application/src/scenarios/`) — a pure, currency-bucketed
comparison of real overdue-receivables exposure against a hypothetical
where one invoice is assumed paid. Surfaced as a "What if this gets
paid?" button inline on `InvoiceRiskCard`, labeled `SIMULATION`, never
mutating anything (no write path exists in the Server Action at all).
Still not built: any other scenario type, persisted `Scenario` objects,
saving/sharing, or snapshot/versioning of business state generally.

### Prompt 15 — Business Memory

A governed temporal memory store (`PREFERENCE`, `POLICY`, `DECISION`,
`COMMITMENT`, `BUSINESS_RULE`, ...) with source evidence, validity
intervals, supersession, and a customer-facing view to inspect/correct/
delete organizational knowledge — never written to directly by an LLM.

**Reality check**: the Organization Business Profile (ADR 0011 —
timezone, expected-response-hours, high-value threshold, industry) is the
one real, narrow instance of a durable organizational fact today, close
in spirit to this proposal's `PREFERENCE`/`BUSINESS_RULE` classes — but
five fixed columns, not a general `MemoryRecord` type. No AI pipeline in
this app persists anything back to state today (the Agent Fabric's one
trigger produces an ephemeral card, never stored as memory), so there is
no real extraction-candidate source to validate against yet. First real
step, if prioritized: generalize Business Profile's five columns into a
small typed settings table carrying the memory-class/validity-interval/
source-evidence shape — still zero AI-authored memories — before any
extraction pipeline.

**Reconfirmed, deliberately not built (2026-08-20)**: nine of the other
prompts in this batch got real slices the same session (ADR 0025–0033) —
this one was checked again, honestly, against every table and feature
added in that pass, looking specifically for a second real instance of a
"durable organizational fact" (`PREFERENCE`/`POLICY`/`BUSINESS_RULE`-class
knowledge) that would justify generalizing Business Profile now. None of
the nine qualifies: `card_feedback` (ADR 0032) and the agent-collaboration
outcome (ADR 0027) are event/audit records, not declarative organizational
knowledge; the invoice-payment scenario (ADR 0031) and the connector
health status (ADR 0026) are computed, not stored facts. Business Profile
remains the sole real instance. Generalizing from a sample size of one
would repeat exactly the premature-abstraction mistake this file's own
discipline exists to catch — so, unlike Prompts 11–14/16–20/17/13 above,
this one stays a reality check only. Not a gap; a deliberate, reasoned
non-action, the same kind of judgment call "build the real slice" is
supposed to require in the first place.

### Prompt 16 — Decision Intelligence Engine

Track business decisions as first-class objects (`Decision`,
`DecisionOption`, `DecisionCriteria`, `DecisionOutcome`, ...), detect when
a Signal requires a decision rather than a task, and run post-decision
review comparing expected vs. observed outcome.

**Reality check**: the real `agent_recommendation` approve/dismiss flow
(ADR 0020) is the closest existing analog — a proposed action with
evidence a human approves or dismisses, fully audited — but it's one
ephemeral card, not a persisted `Decision` object with options/criteria/
deadline/outcome. Generalizing the full object model now would abstract
from exactly one real instance. First real step: add `outcome`/
`reviewedAt` fields to the _existing_ agent-recommendation audit trail so
a decision's result becomes queryable, before inventing
`DecisionOption`/`DecisionCriteria`.

**First real slice built (2026-08-20, ADR 0027)**: `outcome`/`reviewed_at`
columns on `agent_collaborations` (migration 0038), set by
`recordAgentCollaborationOutcome` from the same approve/dismiss Server
Actions that already write the audit trail — a queryable mirror, not a
second source of truth. Surfaced on `/agents`' Collaboration Trace as a
"Decision" row. Still not built: `DecisionOption`/`DecisionCriteria`/
`DecisionOutcome` review, and detecting which Signals need a decision
(blocked on the same missing persisted-Signal entity Prompt 17 is blocked
on).

### Prompt 17 — Adaptive Attention (Signal feedback/personalization)

Lightweight feedback controls (`Useful`, `Not Relevant`, `Wrong Owner`,
...) on Signals, feeding organization/role-level ranking calibration
distinct from rewriting facts, with compliance/financial thresholds
protected from being trained away.

**Reality check**: no Signal in this app is a persisted, identity-bearing
entity yet — `PrioritizedFinding` is recomputed fresh on every read
(already flagged as a gap in this file's Master product/engineering
charter entry above). There is nothing for a feedback control to attach a
foreign key to. This proposal is strictly downstream of the not-yet-built
persisted Signal entity, not buildable in parallel with it.

**Reconsidered and built anyway, for real (2026-08-20, ADR 0032)**: the
"nothing to attach to" premise was too conservative — every finding
already has a real, deterministic id (`{capabilityId}:{organizationId}:{entityId}`,
proven by ADR 0025's Since You Left brief), which is enough for a human
reaction to attach to without a persisted Signal entity existing first.
`card_feedback` (real table, real RLS, live-database-tested writer _and_
reader) captures real `useful`/`not_relevant` clicks on the five
deterministic risk card types via a shared `CardFeedbackButtons`
component. While building this, a real, previously-undisclosed gap was
found: `signals`/`recommendations` are both fully real DDL with zero
application code anywhere — now disclosed in README and
`IMPLEMENTATION-READINESS.md`. Still not built: any ranking/calibration
use of the captured feedback, preference profiles, or reflecting a user's
own prior feedback back on page reload.

### Prompt 18 — Resilience / degraded intelligence

Explicit degraded modes for model/connector/queue/database failure
(`BUSINESS_DATA_STALE`, `AI_DEGRADED`, `CONNECTOR_DEGRADED`, ...),
circuit breakers, dead-letter/retry, fail-closed actions, and calm,
specific status copy instead of generic errors.

**Reality check**: `computeConnectorHealth`'s `"healthy"|"degraded"|
"error"|"unknown"` states (ADR 0021) are a real, if narrow, first slice
of exactly this idea already, distinguishing "stale but real data"
(`degraded`) from "never succeeded" (`error`) per connector. Missing: any
circuit breaker, any queue at all (every write today is synchronous
request/response, so there is nothing to dead-letter), `AI_DEGRADED`/
`REALTIME_DELAYED` states, and chaos/failure-injection tests. Of the ten
proposals in this batch, this is one of the more incrementally buildable
ones — a good candidate for a future narrow slice (surfacing
`ConnectorHealth.status` more prominently as calm status copy,
matching the proposal's own example) without needing a queue/worker
first.

**First real slice built (2026-08-20, ADR 0026)**: `describeConnectorHealth`
composes the existing real `ConnectorHealth` into one calm line matching
the proposal's own example format ("Updates delayed · last synced 18m
ago"), replacing the old two-row readiness display on the connector
detail page. Healthy/unknown stay visually quiet; only degraded/error
pick up the existing severity color tokens. Still not built: any other
degraded-mode state, circuit breakers, queues, or failure injection.

### Prompt 19 — Executive Brief (Morning / Since You Left / End of Day)

Automatic, evidence-linked briefs composed from real Signal/decision/
financial/delivery state, structured around "what changed / what needs
you / what's at risk," honestly saying so when no material change
occurred rather than fabricating narrative.

**Reality check**: the Daily Brief (ADR 0016) is a real, working,
deterministic-assembly precedent for exactly this shape — template-
composed from real findings, persisted, re-readable, honestly labeled
`generatedBy: "deterministic-assembly"`. "Since You Left"/"End of Day"
variants and role/industry-adaptive composition would be a real,
incremental extension of that existing engine, not new architecture —
the most directly buildable proposal in this entire batch on top of what
already exists.

**First real slice built (2026-08-20, ADR 0025)**: "Since You Left" —
`generateSinceYouLeftBrief` diffs the current finding-id set against the
organization's most recent `daily_brief` artifact's `sourceFindingIds`
(deterministic finding ids already make this a real comparison, not a
guess), reporting genuinely new items in full and resolved items as
counts grouped by capability. Stored as the same `daily_brief` artifact
type via a `structuredData.mode` discriminator rather than a new type, so
no migration was needed. A second button next to "Generate Daily Brief"
in `DailyBriefPanel` triggers it. Still not built: `Morning Brief`/
`End of Day` compositions, role/industry adaptation, push/email delivery,
and real per-user visit-history tracking (this slice defines "since you
left" as "since your last brief," not "since you last opened the page" —
see ADR 0025 for why).

### Prompt 20 — Production Hardening & Launch Gate

A full production-readiness audit producing a machine- and human-readable
Launch Matrix (`PRODUCTION_READY`/`FUNCTIONAL_NOT_HARDENED`/`PARTIAL`/
`MOCKED`/`BLOCKED`/`NOT_IMPLEMENTED` per subsystem), realistic end-to-end
and security-focused test scenarios, load testing, backup/restore
validation, and rollback/incident runbooks.

**Reality check**: this is process, not architecture — an audit worth
running once enough of the above is real enough to be worth auditing at
production depth. README's own capability-snapshot table and Known
Limitations section already serve as a lightweight, continuously-updated
version of the Launch Matrix this proposes; whether to formalize a
separate `IMPLEMENTATION-READINESS.md` remains the open question already
logged in the Master product/engineering charter entry above. Right
sequencing: after a real deployment target exists (still undesigned per
README), not before.

**Built anyway, for real, same day (2026-08-20, ADR 0030)**: the user
asked to execute every Prompt 11–20 slice directly rather than wait; five
real feature slices (ADR 0025–0029) had already landed earlier the same
session, which is exactly the condition this reality check named as the
right time to run this audit. `IMPLEMENTATION-READINESS.md` now exists —
a real, evidence-cited Launch Matrix (every classification backed by a
test count, a live run, or a specific ADR/file), including, for the first
time this session, an actual run of the previously-unrun
`pnpm test:production` script (10/10 smoke routes passed, two clean load
tests). No deployment target still exists, so this reports repository
readiness, not launch readiness — the distinction the file's own scope
note makes explicit.

## Prompts 21–40: platform-depth expansion (captured 2026-08-20, unscoped)

Twenty more large proposals arrived in one burst, framed explicitly as a
sequence to run "underneath the persistent SignalDesk Master Wrapper...
sequentially" — the same discipline the Prompts 11–20 burst above already
established, and the user's own instruction on how to proceed: work
locally, one prompt at a time, with a real checkpoint (typecheck/lint/
test/live verification) after each before moving to the next. Logged here
in full so nothing is lost, each with a reality check against what's
actually built today before any of them gets its own scoped-down real
slice. Several of these depend on each other — Goals (22), Commitment
Intelligence (25), and Financial Exposure (26) all lean on the Semantic
Layer (21); Signal Fusion (24) leans on Root Cause (23) and on a
persisted Signal entity neither this burst nor the Prompts 11–20 burst
has built yet — so the real build order will not simply be 21→40.

### Prompt 21 — Universal Business Object & Semantic Layer

A formal `Business Semantic Layer` between raw canonical entities and
higher-level intelligence (`SemanticEntity`, `SemanticField`,
`SemanticMeasure`, `SemanticDimension`, `SemanticRelationship`,
`SemanticMetric`, `MetricFormula`, `MetricDependency`, `MetricUnit`,
`MetricTimeGrain`, `MetricAuthority`, `MetricDefinitionVersion`) so every
metric, Signal, AI investigation, Industry Pack, and visualization uses
the same business definitions, distinguishes `SOURCE_VALUE`/
`NORMALIZED_VALUE`/`DERIVED_VALUE`/`FORECAST_VALUE`, never silently mixes
incompatible currencies/time zones/accounting bases, records full
formula/version/source lineage, and detects metric-authority conflicts
across connectors.

**Reality check**: no aggregate business metric existed anywhere before
this — every `IntelligenceCapability` evaluates one record (or one
filtered risk subset) at a time, never a real total like "accounts
receivable across every open invoice." `IntelligenceContext` only ever
carried filtered subsets built for risk detection (`overdueInvoices`, one
representative `lead`), not the full entity sets a real aggregate needs —
though `listAllInvoices`/`listAllLeads`/`listAllTasks`
(`@signaldesk/persistence`, built for data export) already existed and
supply exactly that. The full twelve-concept object model — persisted
metric-version history, a live multi-connector authority resolver,
generic entity/field reflection over entities that don't exist —would be
speculative infrastructure nothing reads yet, the same trap this file's
own Agent Fabric and gaming-HUD entries already flagged and avoided.

**First real slice built (2026-08-20, ADR 0034)**: a new
`@signaldesk/semantics` package — the full eighteen-concept
`SemanticConcept` vocabulary declared honestly ahead of its metrics (later
prompts in this sequence name these concepts before they have formulas),
but only five real `MetricDefinition`s with real formulas and full
lineage: `accounts_receivable`, `overdue_receivable_exposure`,
`pipeline_value`, `cash_collected_recent`, `open_task_backlog` — every one
computed from data this app already syncs, no new database table or
migration. Currency metrics group by currency rather than ever blending
one silent total. A real, tested `detectMetricAuthorityConflicts` that
can't fire in production yet (every capability class has exactly one
connector with real sync today) but is verified against a synthetic
two-connector scenario. A new `BusinessMetricsPanel` on the command
center, reusing the existing `WhyDisclosure` evidence-panel pattern for
"where did this number come from?" Live-verified with Playwright against
the running dev server, which caught a real honesty bug before it shipped
(`computeOpenTaskBacklog` originally returned a fabricated zero for a
workspace with zero synced tasks) — fixed to return `null` instead. Still
not built: `SemanticRelationship` traversal, persisted metric-version
history, per-tenant authority configuration, or any metric needing data
this app doesn't sync yet (Revenue, Margin, Capacity, SLA, ...).

### Prompt 22 — Goals, Targets and Variance Intelligence

A `Goal Intelligence Engine` connecting business objectives
(`Goal`/`Target`/`KeyResult`/`Milestone`/`GoalOwner`/`GoalPeriod`/
`GoalMetric`/`GoalDependency`/`GoalStatus`/`GoalVariance`/`GoalForecast`)
to live operational evidence via Semantic Metrics, continuously
calculating actual-vs-target/pace/variance/confidence, classifying
`ON_TRACK`/`WATCH`/`AT_RISK`/`OFF_TRACK`/`ACHIEVED`, and surfacing Goal
cards inside the existing command center rather than a new dashboard.

**Reality check**: no `Goal`/`Target` persistence or UI exists at all.
Prompt 21's Semantic Layer now supplies real building blocks a Goal could
reference by metric id (e.g. "keep `accounts_receivable` under $50,000"
is literally computable today), but several of the proposal's own example
goals — DSO, SLA compliance, project margin, headcount, churn — need data
no connector this app has synced carries (aging buckets, SLA policies,
project cost/margin, ATS/HR, subscription-churn tracking). First real
step if prioritized: a `goals` table referencing a real Semantic Layer
`metricId` + target value + period, computing variance deterministically
against the five metrics that already exist, before inventing
`KeyResult`/`Milestone`/`GoalDependency`/`GoalForecast` machinery for
goals with no real metric behind them yet.

**First real slice built (2026-08-20, ADR 0035)**: exactly that scoped
step, real end to end. A `goals` table (migration 0041, forced RLS,
append-only) storing a metric id, comparison operator, and target value —
no period/deadline field, since nothing here can honestly compute pace
against one yet. A new `@signaldesk/goals` package's `evaluateGoal`
computes real variance against the current Semantic Layer metrics, banded
into `ACHIEVED`/`WATCH`/`AT_RISK`/`OFF_TRACK`/`NO_DATA` by a fixed,
disclosed distance-from-target percentage — `ON_TRACK` is declared but
deliberately never produced, since that status specifically claims a
pace/deadline forecast this app has no data to support. A new
`goalVarianceIntelligence` capability surfaces a real finding (routed
through the existing Card Registry, `cardTypeSchema` widened to
`goal_variance`) only for `AT_RISK`/`OFF_TRACK` goals — the "generate
Signals only when materially actionable" requirement, satisfied by
reusing the existing finding pipeline rather than a parallel one. A real
`createGoalAction` (mirrors `createInternalTaskAction`'s idempotent-
insert-plus-audit shape) and a `GoalsPanel` on the command center close
the loop. Live-verified with Playwright, which caught a real bug before
shipping: the created goal didn't appear in the list without a manual
reload, fixed with `router.refresh()`. Still not built: `KeyResult`/
`Milestone`/`GoalDependency`/`GoalForecast`, goal editing/deletion, or any
metric needing data this app doesn't sync (DSO, SLA, margin, headcount,
churn).

### Prompt 23 — Root Cause & Dependency Intelligence

`Dependency Intelligence` using the temporal Business Graph to distinguish
symptoms, contributing factors, and root-cause candidates
(`Dependency`/`DependencyType`/`BlockingRelationship`/
`ContributingFactor`/`RootCauseCandidate`/`ImpactPath`), ranked but never
labeled causal from mere correlation, with an Impact Path UI.

**Reality check**: there is no graph-traversal engine and almost no real
edges to traverse. The Business Graph's only real cross-entity link today
is `Payment.linkedInvoiceExternalIds` — a raw external-id string, never
resolved into an actual `Invoice.id` reference. No connector this app
syncs carries blocking relationships (Asana task dependencies aren't
ingested; there is no approval or RFI concept anywhere). First real step:
resolve `linkedInvoiceExternalIds` into real internal invoice references
— the one genuine relationship this app's already-synced data implies —
before building a general dependency/traversal engine with nothing to
traverse.

**First real slice built (2026-08-20, ADR 0036)**: exactly that. A new
`@signaldesk/dependencies` package's `resolvePaymentInvoiceDependencies`
matches every payment's linked external invoice id against the real
invoice set (exact id + matching source system — never fuzzy), producing
only `CONFIRMED_DEPENDENCY` edges; the other three confidence levels are
declared but unused, since nothing here infers rather than matches.
Wired into the existing `overdue-invoice` finding (confirmed, by reading
`sync-quickbooks.ts` directly, that "invoice still open with a linked
payment" is a real reachable state — the closed-invoice sync only clears
zero-balance invoices) rather than a new card or UI: a still-overdue
invoice with a linked payment now says so explicitly in its summary and
evidence, distinguishing "partial/pending payment" from "no payment
activity at all." Still not built: any second real relationship type,
multi-hop Impact Paths, or root-cause ranking — there is exactly one real
edge, never a chain to traverse yet.

### Prompt 24 — Signal Fusion

A `SignalFusionEngine` (`SignalCluster`/`SignalFingerprint`/
`SignalRelationship`/`SignalEvidenceMerge`/`SignalSupersession`) merging
related candidate Signals from different connectors/engines into one
persistent business situation instead of duplicate notifications, ranked
`SAME_SITUATION`/`CONTRIBUTES_TO`/`CAUSED_BY`/`DUPLICATE_OF`/
`SUPERSEDES`/`RELATED`.

**Reality check**: there is nothing to fuse yet. `signals` is real DDL
with zero application code ever writing to it (the same orphaned-table
finding the Prompts 11–20 burst's Adaptive Attention entry already
surfaced); every real finding today is a `PrioritizedFinding` recomputed
fresh each render, never persisted with a stable identity beyond its
deterministic `{capabilityId}:{organizationId}:{entityId}` id. **Update
(Phase 4b, implementation roadmap, 2026-08-21)**: one of the two
prerequisites is now real — Gmail is a genuine content-bearing connector
(`messages`, ADR 0050), so cross-connector overlap detection (Slack +
HubSpot + Gmail on the same client) is no longer blocked on message-level
intelligence not existing at all. Still fully blocked on the other,
larger prerequisite: no persisted Signal entity exists (`signals` remains
unwritten-to), and Slack itself remains OAuth-only (Gmail was the only
connector this phase extended).

### Prompt 25 — Commitment Intelligence

A `Commitment Intelligence Engine` extracting, verifying, and tracking
business commitments (`Commitment`/`CommitmentParty`/`CommitmentOwner`/
`CommitmentEvidence`/`CommitmentStatus`/`CommitmentConfidence`) from
authorized communications/tasks/contracts/meetings, reconciled against
tracked tasks, surfaced as `Waiting on Them`/`Waiting on Us`/`Due Today`/
`At Risk`/`Broken Commitment` views.

**Reality check**: fully unscoped today. Extraction needs real message
content to extract from — confirmed by direct check:
`packages/persistence/src` has real `ingest*` functions only for HubSpot
deals, Asana tasks, and QuickBooks invoices/payments; Gmail, Slack, Google
Calendar, and Microsoft Outlook/Calendar connectors store OAuth tokens
only, nothing ingests a message or event into any canonical entity yet.
No free-text AI extraction pipeline exists either — the real Claude
provider (ADR 0020) only ever interprets already-structured deterministic
findings, never raw message text. Blocked on real message-content sync
existing first.

**Update (Phase 4b, implementation roadmap, 2026-08-21)**: the named
blocker is resolved — Gmail now really ingests message content
(`ingestGmailMessage` → `messages`, ADR 0050), bounded to the last 30
days, external correspondence only, body hard-truncated to 5,000
characters. This still doesn't build Commitment Intelligence itself: no
AI extraction pipeline over `messages.body_preview` exists, and
`body_preview` is deliberately never read by anything above the ingest
path today (structurally, not just by convention — see ADR 0050). What
Phase 4b did ship as a real, narrower first use of the new data is
`messageFollowUpIntelligence` — a purely deterministic "this inbound
message has no reply yet" signal, not commitment extraction. Building
real commitment extraction over `body_preview` is still its own, later,
separately-scoped phase — this update only removes the "nothing to
extract from" blocker, it doesn't build the extractor.

### Prompt 26 — Financial Exposure & Money Intelligence

A deterministic-first `Financial Exposure Engine`
(`FinancialExposure`/`ExposureType`/`ExposureBasis`/`ExposureRange`/
`ExposureCurrency`) classifying `CONFIRMED_AMOUNT`/`CONTRACTED_AMOUNT`/
`OUTSTANDING_AMOUNT`/`AT_RISK_AMOUNT`/`POTENTIAL_EXPOSURE`/
`FORECAST_IMPACT`, with currency normalization and an honest "how
calculated" on every number, requiring AI interpretation to reference
deterministic exposure objects rather than inventing dollar figures.

**Reality check**: closer to real than it looks. `IntelligenceCard`'s
existing `financialContext` (`@signaldesk/schemas`) already labels
per-finding amounts (`"Overdue receivable"`, `"Pipeline value"`,
`"Potential exposure"`, ...) — a narrower real precedent for exactly this
proposal's spirit. Prompt 21's Semantic Layer now makes two of this
proposal's own exposure types literally real:
`accounts_receivable` ≈ `OUTSTANDING_AMOUNT`,
`overdue_receivable_exposure` ≈ `AT_RISK_AMOUNT`. Missing: any
`FORECAST_VALUE`/`FORECAST_IMPACT` (no forecasting engine), real currency-
rate normalization (no FX rate source), and project margin
erosion/scope/renewal exposure (no project or contract data synced by any
connector). First real step: tag the two existing Semantic Layer metrics
with an explicit `ExposureType`, nearly free given their lineage already
exists, before building FX normalization or forecast-based exposure.

**First real slice built (2026-08-20, ADR 0037)**: all five real Semantic
Layer metrics tagged with the honest `ExposureType` that applies —
`accounts_receivable` → `OUTSTANDING_AMOUNT`, `overdue_receivable_exposure`
→ `AT_RISK_AMOUNT`, `pipeline_value` → `POTENTIAL_EXPOSURE`,
`cash_collected_recent` → `CONFIRMED_AMOUNT`, `open_task_backlog` → `null`
(a count, not money). `CONTRACTED_AMOUNT`/`FORECAST_IMPACT` declared but
never assigned, test-enforced. Surfaced on the same "Where this comes
from" disclosure the Semantic Layer already built — no new UI. Still not
built: `ExposureRange`, FX normalization, or any exposure type needing
data no connector syncs (contracts, forecasts).

### Prompt 27 — Universal Connector SDK

Turning the Connector Framework into a documented, certifiable
`SignalDesk Connector SDK` (`ConnectorManifest`/`AuthenticationProvider`/
`CapabilityDeclaration`/`EntityMapper`/`EventMapper`/
`InitialSyncHandler`/`WebhookHandler`/`ReconciliationHandler`/
`HealthCheckHandler`/`ActionHandler`/`VerificationHandler`), automated
certification tests, versioning, and a bounded extension boundary —
without opening third-party publishing yet.

**Reality check**: a real, working implicit pattern exists (ADR 0021's
`ConnectorCapabilityClass`, `ConnectorReadiness` flags, and — per every
real connector — OAuth exchange → mapper → `ingest*` function → a
`sync_jobs` row), just never named as formal interfaces, never tested for
certification, and never opened beyond hand-written first-party code.
First real step: extract the shape all three real-sync connectors already
follow into one documented internal interface set, before writing
certification tests against it or considering third-party publishing.

**Deferred (2026-08-20)**: ADR 0021 itself already named the two honest
next steps for this platform — "a real adapter behind one of the 15
planned entries, or wiring the already-persisted `SyncCursor` into a real
incremental fetch — not a bigger type system." Formalizing SDK interfaces
now would be exactly the "bigger type system" that ADR explicitly warned
against. Checking both options directly before building anything: the
incremental-fetch option is already done — `incrementalSyncImplemented:
true` for all three real-sync connectors (HubSpot ADR 0023, QuickBooks
ADR 0022, Asana ADR 0024), confirmed by reading
`packages/integrations/src/index.ts` and `sync-quickbooks.ts` directly
(`fetchQuickBooksInvoices`/`fetchQuickBooksPayments` already filter by
`cursorBefore`, with a real closed-invoice reconciliation pass). The
real-adapter option needs an actual registered OAuth app with a real
third party (Salesforce, Xero, ...) — a real, costly commitment on the
same order as the mobile/React Native platform decision this file already
treats as its own, not something to start inside a background feature
pass. With both named next steps either already done or blocked on an
external registration decision, and no third honest option that isn't
speculative type-system work, this prompt has nothing left to build right
now — revisit once a specific new connector is actually being onboarded.

### Prompt 28 — Universal Import / "Connector Escape Hatch"

A governed `Universal Data Intake` layer (secure CSV import, generic
authenticated/signature-verified webhook ingestion, a mapping wizard with
preview/dry-run, `Import Profiles`, honest `CSV_IMPORT` provenance) routed
through the same normalization/authorization/provenance/injection-safety
boundaries as a real connector.

**Reality check**: nothing like this exists — no CSV upload, no generic
webhook intake, no mapping UI. The real `source_records` → canonical-
entity pattern (ADR 0003/0014) is exactly the right target to route
imported data through, since it already carries provenance/idempotency
for free. First real step: one CSV import path for one canonical entity
(most likely invoices, given QuickBooks' own ingest function is the
freshest real template) reusing that existing pattern with
`source_system = 'csv_import'`, before a general mapping wizard.

**First real slice built (2026-08-20, ADR 0038)**: exactly that. A new
`@signaldesk/csv-import` package (a dependency-free RFC4180 parser plus a
fixed-header invoice row validator, 17 tests) and a synthetic per-org
`integrations` row (`source_system: 'csv_import'`) that lets imported
invoices flow through the real `source_records`/`sync_jobs` foreign keys
every connector already requires — never a parallel, lighter path.
Content-hash idempotency reuses the existing `source_records` uniqueness
constraint for real duplicate detection, no new dedup system. A real
preview-then-import UI on `/integrations`, live-verified end to end
(Playwright: file upload → preview flagging 1 bad row → confirm → real
DB write → refreshed "2 invoices imported so far" summary). Still not
built: any entity besides invoices, a mapping wizard, scheduled/webhook
intake, or Import Profiles.

### Prompt 29 — Collaborative Operations / Ownership

An `OwnershipEngine` (`Owner`/`OwnershipRule`/`Assignment`/`Delegation`/
`EscalationPath`/`BackupOwner`/`TeamQueue`) resolving accountable
ownership consistently across Signals/Commitments/Decisions/Approvals/
Actions, with `Mine`/`My Team`/`Unowned`/`Waiting on Me`/`Delegated`
filters.

**Reality check**: real but narrow today. `leads.ownerMembershipId` and
the real `ownershipIntelligence` capability
(`packages/intelligence/src/capabilities/ownership.ts`) are a working
ownership signal — for leads only. Invoices and tasks carry no resolved
owner (`Task.assigneeName` is a free-text string from Asana, never
matched to a membership). There is still no invite/multi-member flow
(confirmed: no `inviteMember`-style function exists in
`@signaldesk/persistence`) despite `memberships.role` already declaring
`owner`/`admin`/`member`/`viewer` — so `Delegation`/`EscalationPath`/
`TeamQueue` have no second real person to delegate to yet. First real
step: extend the existing `ownerMembershipId` pattern to tasks (resolving
`assigneeName` where possible) before building delegation/escalation on
top of a single-person org.

**First real slice built (2026-08-20, ADR 0039)**: exactly that, plus a
discovery worth logging directly — `leads.ownerMembershipId` (ADR 0003)
has never actually been populated; every real HubSpot deal ingest
hardcodes it `null`, confirmed by reading `hubspot-sync.ts` directly. So
this slice is the first ownership resolution to ever actually fire, for
either entity: a new `resolveMembershipIdByDisplayName`
(`@signaldesk/persistence`) does an exact, case-insensitive match between
an Asana task's `assigneeName` and a real member's `users.display_name`
at ingest time, writing a real `tasks.owner_membership_id` (migration
0043, mirroring `leads.ownerMembershipId`'s shape). `Task.owner` reuses
the existing `LeadOwner` type; `overdueTaskIntelligence` prefers the
resolved owner over the previous name-doubles-as-id fallback. Given no
invite flow exists, this can only ever match the org's own single real
member today — narrow, but genuinely real, unlike the leads column it's
modeled on. Still not built: `Delegation`/`EscalationPath`/`TeamQueue`
(no second real person to delegate to), `Mine`/`Unowned` UI filters, or a
fix for the still-dormant leads column.

### Prompt 30 — Presence and Collaborative Live UI

Lightweight collaborative presence (`Viewing`/`Handling`/`Editing
Artifact`/`Approval Pending`), optimistic concurrency/locking against
duplicate consequential actions, and real-time Signal-state sync across
clients — without becoming chat software.

**Reality check**: blocked on the exact same missing piece this file's
gaming-HUD and Zero-Prompt AI entries already flagged: zero live/push
transport of any kind exists. Every page is server-rendered request/
response; nothing pushes new data to an open tab. No presence system has
anything to synchronize until a live-data transport (WebSocket/SSE/
polling) exists first — genuinely downstream of that gap, not buildable
in parallel with it.

### Prompt 31 — Search Without Becoming Chat

A fast, evidence-oriented `SignalDesk Business Search` — structured
filters resolved deterministically where possible, AI used only to
translate ambiguous natural language into a validated query plan, direct
entities shown before any AI summary.

**Reality check**: closer to real than the proposal's framing suggests.
The command bar's existing `parseCommand`/`parseDashboardIntent`
(`@signaldesk/application`/`@signaldesk/schemas`) already resolves
`filter`/`group`/`investigate`/`compare`/`propose_action` intents
deterministically without an LLM wherever the pattern matches — a real,
working instance of exactly this proposal's "resolve deterministic
requests without an LLM where possible" principle, just scoped to
filtering today's findings, not full entity search across leads/invoices/
tasks/artifacts. First real step: widen the existing `filter` intent to
match against entity fields directly (customer name, contact name, task
name) as real search results, before inventing a second command surface.

**First real slice built (2026-08-20, ADR 0040)**: exactly that.
`filterDefinitionSchema` gained a `"text"`/`"contains"` field-operator
pair (a real `.refine()` invariant); a new deterministic `search`/`find`
matcher (deliberately not a bare word, to avoid colliding with ordinary
command-bar prose) parses it without any model call; client-side
matching reuses the cards already rendered, substring-matching
`title + summary` — verified by reading every real capability directly
that customer/contact/task/goal names already land there. Live-verified
(Playwright: real command bar, "search acme", real "No cards match"
response for an empty workspace). Still not built: search across the
full Business Graph independent of rendered cards, a dedicated command
palette, AI-assisted query translation, or saved searches.

### Prompt 32 — Notification & Escalation Policy

A centralized `AttentionDeliveryPolicy` (`IN_APP`/`PUSH`/`EMAIL`)
deciding when a Signal stays silently in-app versus escalates, based on
severity/materiality/ownership/acknowledgement/business hours/policy,
with dedup/digesting and quiet hours — never an LLM independently
deciding to notify.

**Reality check**: the organization-level preference toggles
(`morningBriefEnabled`/`attentionAlertsEnabled`/`weeklyRecapEnabled`,
migration `0021_organization_notification_preferences.sql`) are real,
stored, and already exposed as a real Preferences form — but nothing
anywhere actually reads them to send anything. There is no email/push
delivery mechanism of any kind in this codebase today; these are real
settings for a channel that doesn't exist yet, an honest gap worth
naming directly. First real step: wire one of the three existing toggles
to something real (e.g. an actual scheduled email of the Daily Brief)
before building severity-based escalation, dedup, or quiet-hours logic on
top of a delivery channel that doesn't send anything yet.

**First real slice built** (`docs/adr/0041-notification-email-delivery.md`):
a real, minimal Resend client (`packages/integrations/src/resend/
client.ts`) plus a real "Email me this brief" button that sends the
organization's actual, already-generated Daily Brief on demand —
gated behind an unset `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, same "real
client, inert until configured" convention as every other credential in
this app. This is deliberately **not** a wire-up of `morningBriefEnabled`
or any of the three scheduled-delivery toggles above — those still read
by nothing, since real scheduled delivery needs cron/deployment
infrastructure this app doesn't have. What's real now: the delivery
primitive (a working `sendEmail()` call) and one manual trigger for it.
Severity-based escalation, dedup, quiet hours, and the scheduled toggles
remain exactly as unbuilt as this reality check originally described.

### Prompt 33 — Data Quality & Entity Resolution

A `DataQualityEngine`/`EntityResolutionEngine` detecting duplicate
customers/contacts across providers, conflicting identifiers, and broken
relationships — deterministic identifier matching first, probabilistic
matching only when necessary, human review required for any destructive
merge.

**Reality check**: no duplicate-detection or cross-provider identity
resolution exists at all. Every canonical entity is uniquely keyed by
`(organizationId, sourceRecordId)` with a hard database constraint, but
nothing ever compares _across_ source systems — a HubSpot company and a
QuickBooks customer with the same name today are two entirely unrelated
rows with no relationship modeled between them. First real step: one
narrow, deterministic check (exact-string match between an invoice's
`customerName` and a lead's `companyName` across different source
systems) surfaced as a real `DataQualityIssue` on the Integrations page,
before any probabilistic matching or merge workflow.

**First real slice built** (`docs/adr/0042-data-quality-entity-resolution.md`):
`@signaldesk/data-quality`'s `detectInvoiceLeadNameDuplicates` — exactly
the one check this reality check scoped, no wider vocabulary. Reuses the
existing `listAllLeads`/`listAllInvoices` data-export read paths (ADR
0018), recomputed fresh on every `/integrations` page load, surfaced
through a new `DataQualityPanel` for human review only (no merge action
exists). Live-verified empty state; the "issues found" render path
requires two live connections with overlapping names that this
environment has no credentials to establish, so it's unit-tested (6
tests) but not live-rendered — disclosed in the ADR. Probabilistic
matching, conflicting-identifier detection, and any merge workflow
remain exactly as unbuilt as this reality check originally described.

### Prompt 34 — Schema/Connector Change Detection

An `IntegrationDriftDetector` distinguishing harmless additive API
changes from breaking ones, auto-pausing affected intelligence rather
than silently producing wrong Signals, with customer-friendly and
operator-facing status.

**Reality check**: a real, if implicit, first line of defense already
exists — every mapper (`hubspot/mapper.ts`, `asana/mapper.ts`, ...) is a
strict Zod schema (`sourceLeadRecordSchema`, ...) that already fails
loudly on a shape it doesn't recognize, and `sync_jobs.errorMessage`
already records that failure per run. What's missing: any distinction
between a harmless additive field and a breaking one, and no failure ever
auto-pauses the intelligence capabilities that depend on the affected
data — a validation failure today just means that one sync run recorded
an error, not that dependent findings are flagged as unreliable. First
real step: on a mapper validation failure, mark the affected
`integrations.status` as `degraded` (a value the column's own check
constraint already allows) rather than only recording a raw error string
on the sync job.

**First real slice built** (`docs/adr/0043-connector-degraded-status.md`):
`completeSyncJob` now transitions `integrations.status` to `degraded`
whenever a run skips one or more records, and recovers it to `active`
once a later run skips nothing — automatically at all 4 real sync call
sites, no signature change needed. The harder, non-obvious part: seven
existing `status = 'active'` read paths (overdue invoices/tasks,
priority lead, recent payments, the Business Data Map, account-deletion's
disconnect list, billing's connection count) had to be widened to
`status in ('active', 'degraded')` first, or one skipped record would
have silently vanished a connector's already-valid data from the whole
command center — a regression, not a feature. 9 new live-database tests
prove both the transition and that `degraded` keeps behaving like
`active` everywhere it should; full 304-test persistence suite re-run
against the real Supabase dev project. Auto-pausing intelligence
capabilities, classifying _why_ a record failed (harmless vs. breaking),
and a real drift-severity model remain exactly as unbuilt as this
reality check originally described.

### Prompt 35 — Security Against Prompt Injection from Business Data

Treating all connector content/documents/messages/imported data as
untrusted (`ContentTrustBoundary`/`UntrustedContentEnvelope`/
`InstructionDetection`/`ToolPolicyContext`), with tool permissions
enforced outside the model regardless of what the model claims.

**Reality check**: meaningfully more real than the proposal's framing
implies. `canExecute: z.literal(false)` (`AgentCard`,
`@signaldesk/schemas`) is a hard, schema-enforced invariant on every
agent — no model output can ever grant itself execution authority, a real
working instance of "enforce tool permissions outside the model" (ADR
0020). `specialistInterpretationSchema` already constrains every model
response to structured claims/confidence/recommendation, never free-form
instructions. What's genuinely missing: explicit structural labeling of
evidence text as untrusted before it reaches `claude-provider.ts`'s
prompt construction, and — per Prompt 25's reality check — there is no
live injection attack surface yet beyond deterministic findings' own
bounded text fields, since no Gmail/Slack message content is ingested
anywhere. First real step: audit `claude-provider.ts`'s actual prompt
construction directly to confirm finding evidence is already
structurally delimited from instructions, rather than assuming so.

**Audit performed, real gap found and closed** (`docs/adr/0044-prompt-injection-audit-and-boundary.md`):
finding evidence was interpolated after a plain `"Findings:"` heading —
a formatting label, not a security boundary; the system prompt never
told the model that finding text originates from external,
attacker-influenceable business data. Fixed: `SYSTEM_PROMPT` now names
an explicit `<untrusted_business_data>` boundary and instructs the model
to ignore any embedded instructions inside it; `neutralizeDelimiterEscapes`
closes the naive-delimiter escape vector (an attacker-controlled name
containing the literal closing tag). 2 new tests confirm both the
boundary and the escape-neutralization; full `@signaldesk/application`
suite (113 tests) green. `canExecute: false` and structured-output
validation remain the real, independent second layer bounding blast
radius to "a misleading claim a human must still approve," documented
but not rebuilt. `ContentTrustBoundary`/`InstructionDetection`/
`ToolPolicyContext` as formal types remain unbuilt — no second real
caller exists yet to justify them.

### Prompt 36 — Cost & Performance Optimizer

An `IntelligenceEconomicsEngine` recording real cost/latency/quality per
computation path, per-tenant budgets, model routing, and
duplicate-investigation avoidance, with `cost_per_useful_signal`-style
metrics.

**Reality check**: `internal_cost_events` is real DDL, explicitly
documented in `schema.ts` as unpopulated ("nothing writes to this table
yet") — written before the real Claude provider (ADR 0020) existed, so
that comment is now one real step out of date: there is a real model-
calling path (`claude-provider.ts`) that could write a real cost event
today and doesn't yet. First real step: instrument that one real call
site to write a real `internal_cost_events` row per invocation — the
minimum real data point every other metric this proposal names would
derive from — before building budgets, routing, or dashboards on top of
zero real cost data.

**First real slice built** (`docs/adr/0045-cost-instrumentation-first-write.md`):
`AgentGatewayService.dispatch()` now writes a real
`claude_specialist_invocation` cost event whenever the real
Claude-backed specialist (`agent.provider === "anthropic"`) is actually
invoked — precisely gated so a policy-denied task or a grant-minting
failure (which never reach the provider) never records one, a real bug
this review caught before shipping. Correction to this reality check's
own framing: `recordInternalCostEvent`/`getInternalCostSummary` already
existed as real, working, unwired plumbing — this slice wired the one
real caller and added the missing test coverage (6 new live-database
tests, full 310-test persistence suite green), not new plumbing from
scratch. `estimatedCostCents` stays honestly null — no per-token
pricing table exists to derive a real dollar figure from. Budgets,
routing, dashboards, and dollar-accurate costing remain exactly as
unbuilt as this reality check originally described.

### Prompt 37 — Onboarding That Reaches Value Quickly

Redesigning onboarding around reaching the first trustworthy Signal
rather than completing setup screens, with dynamic next-connector
recommendations and real `FirstValueMilestone` events
(`FIRST_CONNECTION`/`FIRST_SYNC`/.../`FIRST_ACTION_VERIFIED`).

**Reality check**: no onboarding sequence or wizard exists — the
Business Profile form (`business-profile-form.tsx`) is a settings page, not
a guided flow, and no milestone events are tracked anywhere. First real
step: derive one real implicit milestone from existing data (time between
`organizations.createdAt` and an organization's first successful
`sync_jobs` row — both already real, queryable columns) before building
any wizard UI or a dynamic connector-recommendation engine on top of it.

**First real slice built** (`docs/adr/0046-time-to-first-sync-milestone.md`):
`computeTimeToFirstSync` derives real elapsed minutes between org
creation and the first `succeeded` sync job across any connector —
`null` until one genuinely happens, derived on read like
`ConnectorHealth`, never persisted. Surfaced as one honest sentence on
`/integrations` ("Still waiting on your first successful sync ..." or
"Your first real data synced N minutes after you signed up"), not a
wizard. 5 new live-database tests (including a real ~10-minute elapsed
calculation against a controlled historical fixture — discovered along
the way that `organizations.created_at` is immutability-trigger-protected,
ADR 0003, so the fixture had to be a fresh insert with an explicit
timestamp, not a seed-then-mutate), full 315-test persistence suite
green. Live-verified the "waiting" state (Playwright, guest session);
the "achieved" state can't be produced live in this environment (no
real OAuth credentials), verified by the live-database test's real
timestamp math instead. No milestone event log, no wizard, no dynamic
connector recommendation — exactly the line this reality check drew.

### Prompt 38 — Customer Trust Center

An in-product Trust Center giving admins visibility into connected
systems/scopes/AI providers/retention/action policies/audit history, with
toggles to disable connector writes or external agents.

**Reality check**: the pieces exist, scattered rather than consolidated.
`/integrations` already shows connected systems and their real OAuth
scopes implicitly; `/profile` already has real data export and
delete-organization flows (ADR 0018/0032); `AGENT_FABRIC_ENABLED` and the
other Agent Fabric kill switches are real server-side gates, but exposed
in no admin UI today. First real step: one real, read-only page
surfacing what already exists (connected integrations, granted agent
capability ids, kill-switch state) before building any toggle or audit-
export UI on top of it.

**First real slice built** (`docs/adr/0047-trust-center-first-slice.md`):
a new owner-gated `/trust` page consolidates connected systems (new
`listConnectorConnections`), real minted agent capability grants (new
`listRecentAgentDelegationGrants` — the one genuine gap, distinct from
the static declared-capability list `/agents` already showed), and
kill-switch state, with the data-lifecycle and full agent-directory
sections linking to `/profile`/`/agents` rather than duplicating them.
No toggles — every control is a link. 11 new live-database tests, full
322-test persistence suite green; live-verified all four honest empty
states on a real guest session (confirmed a fresh guest org's sole
member resolves to `role: "owner"`). The populated-data render path
can't be produced live here (no OAuth credentials, Agent Fabric
unconfigured) — proven by the live-database tests' real inserted rows
instead. No disable toggles, no retention disclosure, no audit-log
export — exactly the line this reality check drew.

### Prompt 39 — Marketplace Architecture

A governed `SignalDesk Marketplace` (`MarketplacePackage`/`Publisher`/
`PackageManifest`/`CertificationStatus`/`Installation`) distributing
Connectors/Industry Packs/Signal/Metric/Artifact Packs/Playbooks/Agents,
internal-only first.

**Reality check**: fully blocked. Explicitly depends on the Connector SDK
(Prompt 27) and a formalized Industry Pack interface (neither built —
today's industry support is one real field, `organizations.industry`,
and one minimal `industryProfiles` config, per this file's own Industry
pack framework entry above) existing first. No action taken.

### Prompt 40 — Executive "One Page" Final Consolidation

A complete Product Integrity audit after all platform expansion,
classifying every surface as `DAILY_COMMAND_CENTER`/`CONTEXTUAL_DETAIL`/
`ADMIN_CONFIGURATION`/`DEVELOPER_OPERATOR`/`UNNECESSARY`, ensuring the app
has not sprawled into a multi-dashboard suite.

**Reality check**: this is explicitly the prompt to run _after_ the
others in this same burst ("the prompt I would run after the others so
feature growth doesn't destroy the original concept" — the user's own
framing), the same relationship Prompt 20 (Production Hardening) had to
Prompts 11–19. Premature today: most of Prompts 22–39 above are still
unscoped ideas, not real surfaces yet to audit. Deliberately deferred
until real substance exists from this burst to audit against — logged
here so the discipline itself (run this last, not build it alongside
everything else) isn't lost.

**Audit performed** (`docs/adr/0048-product-integrity-surface-audit.md`),
now that Prompts 21–38 each shipped a real first slice: every real
route classified against the five-value taxonomy, added to README's
new "Application surface model — real audit" section. No route
classified `UNNECESSARY` — this session's 17 real prompts added exactly
one new page (`/trust`, ADR 0047). One real finding: `/integrations`
has absorbed capability (CSV import, Data Quality, time-to-first-sync)
beyond its original connector-catalog scope — each addition
independently justified, but recorded as a named sprawl risk for
whoever next touches that page, not silently reclassified or split in
this pass. Confirmed `/agents` and `/trust` are deliberately distinct,
not redundant. Corrected two stale README claims found along the way
(the admin surface was claimed to have "no implementation"; the ADR
count was stale at "thirty-three" against the real forty-seven).

## Customer Operations Intelligence (captured 2026-08-21, unscoped)

A proposal, motivated by Intercom/Fin and Zendesk's 2026 pivot from
"helpdesk" toward broader agentic customer-lifecycle platforms, that
SignalDesk add a `CustomerOperations` layer — not a competing helpdesk,
but the system that fuses what sales, support, success, product,
delivery, and finance collectively say about each customer. Core pieces:
a `CustomerSignalGraph` (Customer fanning out to Sales/Support/Success/
Product/Delivery/Finance/Communication); a `VoiceOfCustomerEngine`
clustering recurring topics/complaints/praise across tickets, chat,
surveys, sales calls with trend/impact/ARR-exposure evidence; a
`SupportToProductEngine` mapping issue clusters to product areas and
affected-customer/revenue context; a `CustomerExperienceEngine` using
labeled evidence dimensions (support friction, communication trend,
delivery, usage, financial friction) rather than one opaque sentiment
score; `CustomerEffortEngine` (repeated contacts, transfers, reopens);
`RenewalIntelligenceEngine` / `ExpansionIntelligenceEngine` combining
contract/usage/support/relationship evidence; a `KnowledgeGapEngine` /
`KnowledgeQualityEngine`; a work-intent classifier (`INFORMATIONAL` /
`PERSONALIZED` / `ACTION_REQUIRED` / `INVESTIGATION_REQUIRED` /
`DECISION_REQUIRED` / `APPROVAL_REQUIRED` / `ESCALATION_REQUIRED`) for
routing; a `CustomerCase` entity for sustained cross-functional
investigation (linked Signals, evidence, teams, decisions, actions,
verified outcome); a `CustomerHandoffPackage` so AI-to-human escalation
never loses context; explicit resolution semantics
(`ASSUMED_RESOLUTION` → `SOURCE_VERIFIED`/`OUTCOME_VERIFIED`, echoing
Zendesk's contained-vs-verified distinction); a `CustomerTimeline` and
contextual `CustomerSituationRoom` for strategic accounts; a
`ConversationQualityEngine`/scorecards across both AI and human
interactions; routing intelligence comparing AI-vs-human outcome quality;
channel normalization (email/chat/SMS/phone/WhatsApp/social/in-app/
video/ticket) into one `CustomerInteraction`; connectors for Intercom,
Zendesk, Front, Gorgias, Freshdesk, Help Scout, Salesforce Service Cloud,
Gainsight, ChurnZero, Vitally, Amplitude, Mixpanel, PostHog, Sentry,
Datadog, Jira, Linear; packaged as a formal `CustomerOperationsPack`
integrated into the One-Page Command Center via summary signals, not a
new dashboard hierarchy.

**Reality check**: this is a large, well-structured elaboration of the
Business Graph vision already captured above (Master product/engineering
charter entry, and Prompt-series `Account`/`Opportunity`/`Contract`
entities) — filtered specifically through a customer-support/CX lens —
not a new category of proposal. What's real today, precisely: the
Business Graph has exactly three canonical entities (`leads`, `invoices`,
`tasks`) — no `Customer`, `Account`, `Contact`, `Case`, or `Conversation`
entity exists; a lead's `companyName` is a free-text string, not a
relationship to anything. The connector catalog already anticipates a
support layer better than expected — `ConnectorCapabilityClass` includes
`"support"` (ADR 0021), and `zendesk`/`intercom` are already catalog
entries (`packages/integrations/src/index.ts`, `capabilityClasses:
["support"]`, `supportedEntityTypes: ["support_ticket"]`) — but both are
`availability: "planned"`, meaning catalog metadata only: no OAuth flow,
no sync job, no mapper, no ingested row, same gap as every other
`"planned"` connector. Zero support/ticketing/product-analytics data of
any kind flows into this app today. This proposal's connector list
(Front, Gorgias, Freshdesk, Help Scout, Salesforce Service Cloud,
Gainsight, ChurnZero, Vitally, Amplitude, Mixpanel, PostHog, Sentry,
Datadog) has no catalog entries at all yet. Real message-content
ingestion (email/chat body text, as opposed to metadata) is explicitly
still an undecided fork in the active implementation roadmap (Phase 4,
`C:\Users\borah\.claude\plans\cozy-snuggling-puppy.md` — "a second CRM
connector" vs. "real message-content ingestion," not yet chosen) — most
of `VoiceOfCustomerEngine`/`ConversationQualityEngine`/`KnowledgeGap
Engine` above are downstream of resolving that fork with option (b) and
then building at least one support connector's real sync path, not
buildable in parallel with it. `WorkIntent` classification and quality
scorecards additionally need a real usage baseline before they're
verifiable rather than guessed — this repo's own Evaluation Lab phase
(Phase 5, gated on real AI usage volume existing first) is the
established precedent for not building evaluation-shaped infrastructure
ahead of real usage. Renewal/expansion intelligence would read this
business's _own_ Stripe subscription data if repurposed for
SignalDesk's own paying customers, but this proposal means the tenant's
_own_ customers — a distinct, currently-nonexistent revenue-relationship
concept requiring the `Customer`/`Contract`/`Opportunity` entities above
to exist first. Sequencing, if prioritized later: (1) resolve the Phase
4 fork toward message-content ingestion or a first support connector,
(2) let that decide whether `Customer` becomes real as a promoted `lead`
or a new first-class entity, (3) build one real `VoiceOfCustomer`-style
signal end-to-end against that one real connector before generalizing to
a `CustomerOperationsPack` — the same "one real vertical before the pack
abstraction" discipline the Industry pack framework entry above already
established and validated.

**Update (2026-08-21)**: steps (1)–(3) of the sequencing above are now
real, narrowly. The Business Graph gained a fourth entity (`messages`,
Gmail, ADR 0050, resolving the Phase 4 fork toward message-content
ingestion) and then a fifth (`support_tickets`, Zendesk, ADR 0054) — the
first real support connector, closing the "zero support/ticketing data
flows into this app" gap this reality check named. `ticketRiskIntelligence`
(`packages/intelligence/src/capabilities/ticket-risk.ts`) is exactly the
one real `VoiceOfCustomer`-adjacent signal step (3) called for: a stuck-
ticket finding, evaluated deterministically against real ingested
tickets, not a `CustomerOperationsPack` or any AI-based classification.
Step (2) — whether `Customer` becomes a promoted `lead` or a new
first-class entity — remains genuinely undecided; `support_tickets` was
deliberately built with no cross-entity link at all (see ADR 0054) rather
than force a decision this narrow slice didn't need to make. Everything
else in this proposal (`VoiceOfCustomerEngine` clustering, `WorkIntent`
classification, `CustomerCase`, the full connector list beyond Zendesk)
remains exactly as unbuilt as this reality check already described —
this update narrows the gap by one real step, not the whole proposal.

## Customer/Business Intelligence Platform Layer — 30 more capabilities + "Business Context API" (captured 2026-08-21, unscoped)

A same-day follow-on to the Customer Operations Intelligence entry
above, adding 30 more named capabilities across four groups — Customer
360/Relationship (`Customer360`, `CustomerRelationshipGraph`,
`StakeholderCoverageIntelligence`, `RelationshipMomentumEngine`,
`CustomerJourneyStateMachine`, `JourneyAnomalyDetection`,
`CustomerFrictionGraph`), Knowledge/Resolution (`VoiceOfCustomerPattern
Mining`, `ProductFeedbackIntelligence`, `CustomerEffortIntelligence`,
`KnowledgeGapDetection`, `KnowledgeConflictDetection`, `KnowledgeFreshness
Engine`, `KnowledgeToOutcomeAnalytics`, `AIResolutionVerification`,
`ResolutionLearningLoop`, `IntentToWorkflowRouter`, `DynamicHuman/AIRouting`),
Agent Governance (`AISupervisor`, `AgentIdentityRegistry`, `AgentPermission
Graph`, `ShadowAIDiscovery`, `AIBlastRadiusCalculator`), and Process/Outcome
(`BusinessProcessMining`, `ProcessBottleneckIntelligence`, `ProcessDeviation
Detection`, `AutomationOpportunityDiscovery`, `Outcome/ROILedger`,
`BusinessOutcomeObservatory`, `AutonomousOperationsBoundary` — an explicit
per-action-class automation ceiling, `OBSERVE_ONLY → RECOMMEND → PREPARE →
REQUIRE_APPROVAL → AUTO_EXECUTE_LOW_RISK → NEVER_AUTOMATE`). Also proposes
a longer-term reframing: SignalDesk as a governed **Business Context
API** — a permission-aware, temporal, evidence-backed interface any
authorized human, application, or AI agent (internal or external, e.g. a
customer's own MCP client) could query for "what's the current business
context around this entity/event/decision," with the One Page staying
the human interface and this API becoming the machine one.

**Reality check**: heavy, real overlap with proposals already captured
above — not a fresh category. Items 1–7 (Customer 360/Relationship
Graph/Stakeholder Coverage/Journey) need the same `Customer`/`Contact`/
`Person` first-class entity the Customer Operations Intelligence entry
already identified as missing (today's Business Graph has `leads`,
`invoices`, `tasks`, `messages` — no customer/contact/person object).
Items 8, 10–15, 17 (Voice-of-Customer, Effort/Knowledge-Gap/Knowledge-
Quality, resolution verification, intent classification) are near-exact
restatements of that same earlier entry's `VoiceOfCustomerEngine`/
`CustomerEffortEngine`/`KnowledgeGapEngine`/`KnowledgeQualityEngine`/
resolution-semantics/`WorkIntent` proposals — same blockers apply (no
message/document content connector beyond Gmail as of Phase 4b, no
usage-baseline for verifiable classification).

**Agent Governance items (19–23) have a real, if partial, foundation to
extend, unlike the rest**: the Agent Fabric (ADR 0020) already has a
real trust boundary (`AgentGatewayService`) minting time-bounded
capability grants, agent-attributed audit events, a registry
(`AGENT_REGISTRY`) of exactly two specialists, and `canExecute: false`
enforced everywhere. That is a genuine seed for `AgentIdentityRegistry`/
`AgentPermissionGraph` — but today's registry has two entries, both
internal, both already fully trusted by construction; `ShadowAIDiscovery`
(detecting _unregistered_ agents) and `AIBlastRadiusCalculator` presume a
much larger, more heterogeneous agent population (third-party agents,
customer-side MCP clients) than exists or is even architecturally
possible yet — nothing external can currently reach this system's agent
surface at all.

**Process/Outcome items (24–29) need infrastructure this repo has
correctly, repeatedly declined to build ahead of need**: `Business
ProcessMining`/`ProcessBottleneckIntelligence`/`ProcessDeviationDetection`
all require a live event fabric (the same missing piece blocking
Sections 10/14–16/39/45–47 of the Feature Dictionary coverage report) to
have anything to mine patterns from — today's app is request/response
only, no event stream of any kind. `Outcome/ROILedger`/`BusinessOutcome
Observatory` have exactly one real interim signal to build from today:
`card_feedback` (ADR 0032, useful/not-relevant reactions on real cards) —
a real but narrow foundation, not the multi-system outcome attribution
these two propose.

**The Business Context API reframing is the one genuinely new, higher-
leverage idea in this batch** — distinct from "build more detection
engines," it's an architectural stance about _how_ everything already
captured in this file (Business Graph, Signal, Ownership, evidence/
provenance) gets exposed once it exists, including to external
AI agents. Real prerequisites, checked directly: `apps/web/app/api/`
has exactly one route today (`GET /api/business/snapshot`, auth-gated,
built for this app's own client, not third-party callers) — no public
developer API, no API key/service-account auth model, no per-scope
permission system beyond RLS tenant isolation exists to build a governed
external-facing API on top of. This is squarely the "public developer
API + webhooks + SDKs + service accounts" item the Master product/
engineering charter entry above already captured under "Enterprise
platform layer," now with a sharper name and rationale — not a new
prerequisite-free proposal.

**Sequencing, if prioritized later**: same discipline as every entry
above — a persisted Signal entity and a live event fabric are the two
real, named, oft-recurring blockers underneath most of groups 1–2 and
all of group 4 respectively; Agent Governance's real next increment is
narrower (formalize `AGENT_REGISTRY` into a real `AgentIdentityRegistry`
table the moment a third real agent or any external caller is ever
added, not before); the Business Context API is a genuine "when
Command's real capabilities are broad enough to be worth exposing
externally" decision gate, not a build to start now.

## Public lead-capture form (captured 2026-08-21, unscoped)

A form SignalDesk itself hosts — embeddable on the business's own
website, or a hosted link — that intakes a new lead directly into the
Business Graph, distinct from every existing connector: not a
third-party API sync (`source_records` → normalized-entity), but a
first-party direct submission from the business's own prospective
customer. Meaningfully smaller and more concrete than the platform-layer
proposals above; closer to a real candidate slice than an unscoped idea.

**Reality check**: `leads` (`packages/persistence/src/schema.ts`)
already requires a `sourceRecordId` (`NOT NULL`, FK to `source_records`)
— every lead today is provenance-traced back to a specific external
connector sync, a real, deliberate integrity guarantee (CLAUDE.md:
"every record traces back to a real source system"). A direct public
submission has no external system to attribute to, so it cannot reuse
the existing `source_records` → `leads` path unchanged; either
`source_records.source_system` gains a real `"signaldesk_form"` (or
similar) value representing the platform itself as the source (the
simpler, more consistent option — keeps one lead pipeline, one
provenance model, and means every existing `active`/`degraded`-
integration-status read path needs no new branch since a form
submission isn't gated behind connector connection status the same way),
or a second, parallel lead-intake path is built (more code, a second
thing to keep in sync with the real one, and a real precedent problem
for the next "how do leads get in" question). No public,
unauthenticated write endpoint of any kind exists in this app today —
`apps/web/app/api/` has exactly one route, auth-gated,
`GET`-only. A public form submission is this app's first
unauthenticated write surface, which raises real, not-yet-designed
questions this entry doesn't resolve: spam/abuse protection (the
existing `checkRateLimit` keys by IP, real but not sufficient alone
against a public form), honeypot/CAPTCHA, and which organization a
given embedded form's submissions belong to (a real, per-organization
form needs its own identifier — a public "form key" of some kind — since
there is no session to resolve tenant context from, the same
pre-authentication problem `validate_organization_invite_token`
(Phase 3) already solved once for a different real case and is the
closest existing precedent to reuse).

**Sequencing, if prioritized later**: (1) decide `source_system` value
vs. a parallel path (recommend the former); (2) design the
per-organization public form key/identifier, reusing Phase 3's
pre-authentication SECURITY DEFINER pattern; (3) add abuse protection
before making the endpoint reachable from the open internet, not after;
(4) one real end-to-end slice (one form, one org, real leads landing in
the Business Graph, live-tested) before any embeddable-widget/customization
layer.

## Bring-your-own AI key + AI-executed connector actions + remote workspace (captured 2026-08-21, unscoped)

A proposal to let an organization link its own API key (OpenAI, Claude,
or "any AI provider") and have that AI respond to Gmail/Slack/connector
messages and "do any other task," framed alongside a "desktop or virtual
disk where people can work from anywhere" concept.

**Reality check**: three distinct ideas bundled together, each mapping
to already-captured territory, not a new category:

- **Bring-your-own AI provider key** is genuinely new relative to
  today's model: `createClaudeProvider()` (ADR 0020) is gated behind one
  platform-wide `ANTHROPIC_API_KEY` env var, not a per-organization
  credential. Making it per-tenant would need its own secure-storage
  design (the existing Supabase Vault pattern already used for connector
  OAuth tokens is the obvious real precedent to extend) and, per the
  Zero-Prompt AI entry above, was explicitly deferred already ("second
  AI model vendor/router" is named as its own future decision gate in
  the implementation roadmap's foundational decisions, not decided now).
- **AI responding to Gmail/Slack messages** is exactly the connector
  catalog's already-disclosed `email-draft-actions` capability
  (`packages/integrations/src/index.ts`, `actionsImplemented: false`) —
  a named, known gap, not a new idea. It's also squarely inside the
  Agent Fabric's own stated boundary: `canExecute: false` everywhere,
  by design (ADR 0020) — an agent proposes, a human approves, nothing
  in this codebase auto-sends anything today, and loosening that is a
  real, deliberate trust-boundary decision this entry doesn't make.
  **Update (2026-08-24, ADR 0056)**: this specific gap is now closed
  for Gmail — `actionsImplemented: true`, a real `gmail.send`-scoped
  write, still fully gated behind human approval, `canExecute` still
  hard-`false`. Slack is unaffected; still `actionsImplemented: false`
  there, and nowhere else.
- **"Desktop or virtual disk, work from anywhere"** is too undefined to
  scope from this message alone — unclear whether it means a
  browser-based workspace (this app already is one), a literal remote
  desktop/VM product, or something else. Flagged here rather than
  guessed at; needs a follow-up conversation to become a real proposal.

**Sequencing, if prioritized later**: per-org BYO-AI-key storage is the
one concretely scoped, buildable piece here (extend the Vault pattern);
it does not by itself unlock "AI responds to messages," which is
gated on the separate, deliberate `canExecute`/write-action trust
decision the Agent Fabric was built around, not on which API key is used.

## UX Simplification / One-Surface Refactor (captured 2026-08-21, partially built same day)

A large proposal to formalize "SignalDesk may be complicated underneath, it
must never feel complicated on top" as an enforced UX architecture, not just
a stated principle. Core framing: a strict interaction hierarchy — Level 1
(the One Page), Level 2 (popover, tiny interactions), Level 3 (side drawer,
for anything needing more context — the One Page stays mounted and visible
behind it), Level 4 (focus modal, for consequential/explanatory tasks like
a real OAuth connection) — plus a `GLANCE → INSPECT → ACT` mode vocabulary
covering the whole app, a reusable `OverlayRouter` architecture so entities/
Signals/connectors/settings all open contextually with deep-linkable URLs
and working browser back/forward underneath, a universal `QuickAdd` (`+`),
a universal command/search bar ("Search or tell SignalDesk what to do…"),
contextual connector recommendations at the point of a real coverage gap
(Money → suggest QuickBooks/Xero; Communication → suggest Gmail/Slack) in
place of expecting users to visit an Integrations page unprompted, a
drastically reduced primary nav (Home/Search/Connect/Settings, resisting
one top-level item per internal engine), and mobile bottom sheets as the
small-screen equivalent of a desktop drawer. Explicit non-negotiable: never
reduce security confirmations, OAuth consent, or high-risk approval clicks
to hit a click-count target — simplify presentation, not safety.

**Reality check, and what's real as of today**: the concrete complaint that
triggered this ("connecting each connector feels like two layers — a
button that takes you to another page") was accurate and specific:
`/integrations` (list) → `/integrations/{slug}` (a full separate page,
its own route, its own scroll position, a manual "Integrations" breadcrumb
back-link) was a real destination-page hop for what is, in this app,
usually a two-minute glance-and-connect interaction — precisely the
`Navigate → navigate → configure → navigate → back` pattern this proposal
names, and a real gap against this repo's own long-standing `CLAUDE.md`
principle ("progressive disclosure — cards, drawers, detail pages — never
a maze of sub-dashboards"), not a new bar being invented.

**Built the same day, for real, as the first concrete slice — item 4
("Integrations should become a drawer") and the Level-3 side-drawer pattern
generally**: `/integrations/{slug}` is now a real Next.js parallel +
intercepting route, App Router's own documented pattern for exactly this
"modal with a shareable URL" shape. Clicking a connector card opens its
detail as a slide-in drawer over the still-visible, still-mounted page
behind it — closes via an ×, `Escape`, or a backdrop click, and the URL
updates to `/integrations/{slug}` the whole time (deep-linkable,
`router.back()`-friendly, satisfying this proposal's own "keep URL routing
underneath" requirement). A direct visit — an OAuth callback redirect, a
bookmarked link, a refresh — never engages the intercepting route at all
(Next.js only intercepts an in-app `<Link>` soft navigation), so it still
renders the real, complete full page unchanged; this matters concretely
here since every real OAuth provider redirects back to this exact URL
after consent, and that flow cannot be a client-side interception. Both
the drawer and the full page share one `ConnectorDetailContent` component
(`[slug]/connector-detail-content.tsx`) for the actual data-fetching/
rendering, so there are not two copies of this logic to drift. One real
layout bug was caught live, not by typecheck: the full page's two-column
hero grid (`minmax(0,1fr) minmax(300px,0.42fr)`) badly mid-word-wrapped
the connector name inside the drawer's narrower, fixed 720px panel — a
`@media (max-width: 720px)` query didn't catch it, since that checks the
browser viewport, not the drawer's own width, which is a fixed value
independent of viewport size. Fixed with an unconditional
`.connectorDrawerPanel .connectorDetailHero { grid-template-columns: 1fr; }`
override, verified via a re-screenshot, not assumed fixed from the CSS
alone.

**Also built since this entry was first captured, both worth recording
here rather than leaving this reality check stale (`SELF-HEALING-AUDIT.md`
Iterations 37-38 have the full detail):**

- The exact "reasonable next slice" this entry originally suggested — a
  `support_tickets`/`ticket_risk` card opening its own ticket detail as a
  drawer — is real and done: `/tickets/{id}` has the identical
  intercepting-route/shared-content-component shape as connectors.
- The intercepting route for **both** entities now lives at the app
  root (`app/@modal/(.)integrations/[slug]/`, `app/@modal/(.)tickets/[id]/`)
  — not nested under `/integrations/@modal/` the way this entry originally
  described the connector drawer. That move fixed a real bug this entry's
  own "Built the same day" claim didn't know about yet: a Next.js
  intercepting route only engages when the _current_ route is already
  inside the segment that owns the `@modal` slot, so nesting it under
  `/integrations` meant the identical `<Link href="/integrations/{slug}">`
  on a Today-page card (`integration-health-card.tsx`) silently fell back
  to a full page navigation instead of the drawer — the exact
  `Navigate → navigate → configure → navigate → back` pattern this whole
  proposal exists to close, reopened by one routing-scope detail nobody
  had reason to suspect until Today's own card-originated click was
  actually tested end to end. Root-level placement fixes it for both
  entities and for any future one, matching the pattern's own intent that
  a Level-3 drawer should be reachable from wherever a link to it
  naturally appears, not just from one specific list page.
- Live-verified via both a real Playwright script and the actual
  committed E2E suite (`e2e/drawer-focus-trap.spec.ts`,
  `e2e/signup-to-integration.spec.ts`, run for real via `pnpm e2e`, not
  approximated): open/close via all three mechanisms, the page stays
  mounted and visible behind the drawer throughout, correct URL
  round-trip on both open and close, real WAI-ARIA focus-trap/restoration
  behavior, the pre-existing direct-visit/OAuth-callback path unchanged,
  zero console errors, clean `pnpm -r typecheck` and clean
  `pnpm --filter @signaldesk/web build` (route manifest shows
  `/(.)integrations/[slug]`, `/(.)tickets/[id]`, `/integrations/[slug]`,
  and `/tickets/[id]` as four distinct, all-successful routes).

**Explicitly not built, named rather than silently dropped**: a generalized
`OverlayRouter` abstraction (this slice hand-writes one parallel/
intercepting route pair for one entity — connectors — using Next.js's own
native primitive directly; there is no shared, reusable "any entity can
declare an overlay" framework yet, and building one now, before a second
real consumer exists, would repeat this session's own repeatedly-rejected
"types nothing reads" speculative-infrastructure pattern). The universal
`QuickAdd` control. The universal command/search bar (`⌘ Search or tell
SignalDesk what to do…`) and the natural-language action resolution behind
it. Formalizing `GLANCE`/`INSPECT`/`ACT` as a named, enforced mode across
every route (today it's true in spirit in a few places — the command
center's cards, the new connector drawer — but not declared as an
architecture other routes are audited against). The full route-by-route
classification this proposal calls for (`PRIMARY_SURFACE`/`DRAWER`/
`POPOVER`/`MODAL`/`BOTTOM_SHEET_MOBILE`/`ADMIN_ONLY_PAGE`/
`REMOVE_OR_MERGE` for every existing route, nav item, and settings page).
Contextual connector recommendations at the point of a coverage gap (Money/
Communication call-to-connect cards). Primary-nav reduction (today's nav —
Today/Integrations/Pricing/Profile/Billing/Agents/Trust — is already
smaller than the "Dashboard/Signals/Customers/.../Automations" anti-example
this proposal warns against, but hasn't been deliberately re-audited
against a Home/Search/Connect/Settings target). Mobile bottom sheets (no
mobile-specific layout exists anywhere in this codebase yet — the drawer
built today is desktop-shaped only; a `@media` narrow-viewport version
currently just narrows the same side-drawer to full width rather than
becoming a bottom sheet). A `Customer`/entity detail page becoming a
Level-3 drawer the way connectors just did — no `Customer` entity exists
in this Business Graph at all yet (see the Zendesk/`support_tickets` ADR,
0054), so there is nothing to open a drawer onto for that specific example
in the proposal yet. Popovers/Level-2 "tiny interactions" generally (no
component of this shape exists in this codebase before or after today).

**Sequencing, if prioritized further**: the connector drawer shipped as
the smallest real proof of the pattern, not a down-payment on the whole
architecture at once — matching this session's own repeated "one real
vertical before generalizing" discipline (Gmail before a second content
connector, Salesforce before a `CrmConnector` interface, etc.). The
reasonable next slice this entry originally named — a second concrete
Level-3 drawer, on the ticket entity — is now the real, done thing
described above, so the specific recommendation this paragraph used to
make is no longer open. The condition it named for extracting a shared
`OverlayRouter` primitive ("two real examples instead of one hypothetical
one") is now genuinely met — connectors and tickets both exist as real,
independently-verified Level-3 drawers, sharing the same
parallel/intercepting-route shape but still two separate, hand-written
implementations, not one shared abstraction. Extracting that shared
primitive from these two real examples is the next honest step in this
proposal's own stated order, if this direction is prioritized again — not
a third hand-written entity-specific drawer, which would just delay facing
whatever the first two examples reveal about what a real `OverlayRouter`
interface needs to cover.

## AI Business Operator / "Devin of business" (captured 2026-08-24, unscoped)

A category-level reframe, explicitly modeled on Devin's product paradigm
(delegate an outcome, not a sequence of instructions; the agent
understands an environment, plans, uses tools, executes over a long
horizon, verifies its own work, and reports back) mapped onto business
operations rather than software engineering. Core new vocabulary this
proposal introduces: a **Business Mission** (a durable, delegated business
outcome — "recover the overdue Acme invoice," not a chat message — with
objective/scope/authority/policy/plan/evidence/approvals/outcome as real
fields); a **Business Agent** as a first-class entity with identity, role,
permissions, budget, and a job description ("Revenue Agent: protect and
grow revenue, authorized to inspect CRM/billing/communication and prepare
follow-ups, not authorized to issue refunds or change pricing") rather
than a capability string; a **Business Workspace** (the agent's bounded,
authorized operating context — Business Graph + evidence + policies +
active Mission, never the whole tenant blindly); **Playbooks** (reusable
operational procedures an agent executes intelligently, adapting and
explaining deviation rather than following a brittle script); **Autopilot**
(a human sets objective/scope/authority/budget/escalation rules once, the
agent handles recurring work within it, continuously monitoring rather
than continuously thinking); and **outcome-based agent evals** (Mission
completion rate, verified action success, human intervention rate, false-
action rate — scored against whether the real business outcome happened,
not whether the model's answer was well-formed). The proposal's own
research grounding matches what ADR 0020/0056 already independently
concluded: MCP as a possible external tool/context boundary (not a
replacement for native services), A2A only if real third-party agent
interop becomes a requirement (not adopted speculatively), human approval
as a real control-plane decision outside the model rather than a
in-conversation pause, and a maturity ladder from OBSERVE through BOUNDED
AUTONOMY that the proposal itself says must be earned level by level, never
jumped.

**Reality check.** A large share of this proposal's individual mechanisms
already exist, independently arrived at, under different names — this is
mostly a renaming/reframing exercise for those pieces, not new territory:
`AgentGatewayService` (ADR 0020) already is the "the system decides, not
the model" authorization boundary the proposal calls for; `AgentCard`
(`packages/schemas`) already carries capability/risk/budget fields close
to a "Business Agent" identity, just keyed to a platform-defined specialist
roster, not an org-configurable one; `ConnectorCapabilityClass` (ADR 0021)
is already the capability-not-vendor abstraction the proposal's "business
capabilities, not infrastructure" section asks for; `agent_collaborations`
and `customer_email_replies` (ADR 0056) together are already a real, if narrow,
propose→authorize→execute→verify→audit loop with a durable row, audit
trail, and idempotency — the mechanics of one real "Mission," without the
name or the multi-step planner. What genuinely does not exist: a Mission
object as a durable, inspectable, resumable multi-step plan (today's two
real collaboration patterns are each a single bounded call-or-fan-out, not
a plan with steps a human can see progress through); any named Business
Agent role beyond the two platform specialists (`claude-specialist`,
`deterministic-specialist` — neither has a "job description" distinct from
its declared capabilities, and there is no org-configurable agent roster);
a Business Workspace as a real, separately-constructed bounded-context
object (today each server action hand-assembles exactly what it needs
inline — `getTodaysAttention`, `getMessageDraftContext` — which is
arguably _already_ the discipline this concept asks for, just not reified
as its own named abstraction); Playbooks (nothing reusable/parameterized
exists — every real flow, including the new message-reply-send one, is a
hand-written server action, not an instance of a playbook template);
Autopilot (zero scheduled/continuous agent work exists at all — see the
Zero-Prompt AI entry above, still blocked on the same missing background-
job-runner); and outcome-based agent evals (see the Evaluation Laboratory
section of `docs/feature-dictionary-coverage.md` — `card_feedback` is the
only real evaluation signal in this codebase, and it measures a
deterministic card's usefulness, not a Mission's completion).

**What this session actually did, for grounding.** Immediately before this
entry was captured, the Agent Fabric was extended with its first real
external-system write (ADR 0056 — a fourth capability, a second
collaboration pattern, and a real Gmail send behind human approval,
verified live against the real dev database and a running instance of the
app). That is the smallest real instance of this proposal's own "first
real Mission" test (Section 42 of the source proposal: "find the strongest
existing workflow that can become a true end-to-end Mission... implement
that completely, then generalize") — it is not itself a Mission object,
but it is exactly the kind of real, narrow, fully-verified slice this
proposal's own discipline (Section 41: repository-first, extend don't
duplicate) and this repo's `CLAUDE.md` both call for before any
generalization. The honest next step, if this direction is prioritized, is
naming and building the Mission abstraction _from_ this real case (and the
existing `PARALLEL_SPECIALISTS` investigation) rather than designing it
speculatively ahead of a second real instance to generalize from — the same
sequencing discipline the Agent Fabric entry above already followed once.

**Update (2026-08-24, this session): the same proposal returned, now with a full agent-persona spec.** A much more concrete version of this exact entry arrived: a Devin-vs-SignalDesk comparison table, four architectural pillars (goal-oriented planning loop, sandboxed dry-run simulation, a sub-specialist swarm, a self-healing execution gateway), a "Physical Desk" UI metaphor (Matters Tray / Work Mat / Desk Drawers replacing the current One Page), and eight full agent system-prompts with tool contracts and JSON output schemas: **Chief of Staff** (meta-planner, DAG decomposition), **Revenue Recovery Specialist** (QuickBooks/Stripe/Xero/HubSpot exposure analysis), **Delivery & Project Operations Specialist** (Asana/Jira bottleneck diagnosis), **Executive Communication Assistant** (drafting), **Desk Triage Engine** (groups cross-connector signals sharing a customer into one "Matter," classifies urgency and execution mode), **Active Execution Engine** (runs one DAG step at a time against a persisted plan/step-memory state), **Pre-Flight Compliance & Policy Auditor** (validates an `ActionProposal` before it reaches the human), and a **Resilience & Self-Healing Agent** (deterministic recovery matrix per HTTP error class — reauth/backoff/refetch/escalate). A pipeline diagram chains all eight: Triage → Chief of Staff plan → Work Mat execution loop → Pre-Flight Auditor → (on failure) Self-Healing → render one approval card.

This version is real design work, not hand-waving — it's worth being specific about what it gets right and the one place it still needs to bend to this repo's own settled principles before any of it gets built:

- **It correctly preserves the non-negotiable invariant.** Every step spec keeps `requires_approval: true` on every external mutation and explicitly forbids marking a step complete before human confirmation — including the self-healing agent, which only ever retries an _already-approved_ payload after a transient failure (401/429/409/404), never proposes a new one. This is compatible with `canExecute` staying hard-`false` and does not need to be relitigated.
- **The one real conflict worth stopping on:** the "Work Mat"'s live tool feed (`Querying Xero...`, `Checking Asana dependency tree...`) and each step's `thought_trace` field expose named, distinct specialist identities directly to the operator, mid-work. ADR 0020 settled this the other way: "customer-facing UX stays one AI, not a visible swarm" — SignalDesk may be complicated underneath, but the surface shows one coherent narrative, never multiple AI personalities transacting in view (this is restated as a hard rule in this repo's root `CLAUDE.md`, not just this backlog). Before any of the Work Mat ships, that transparency goal needs to be re-expressed as one Chief-of-Staff-voiced narration ("Checking Acme's account across billing and delivery…") that happens to be _produced_ by specialist calls underneath, rather than a literal per-agent console log. The investigative value (operator sees real progress, not a spinner) survives that translation; the swarm-visibility does not need to.
- **What's newly true since this entry was first written**, changing its own "honest next step": at capture time, exactly one real single-specialist propose→approve→execute loop existed (Gmail, ADR 0056). As of this same session (ADR 0057), there are now _five_ — Gmail, Asana, Zendesk, HubSpot, QuickBooks, each its own `single_specialist` collaboration, its own send-tracking table, its own approve action. The "second real instance to generalize a Mission abstraction from" this entry said didn't exist yet, now does, four times over. That materially changes the risk of generalizing now: a `Mission`/`agent_plan` abstraction built today would be induced from five real, live-verified cases instead of designed speculatively ahead of a second one.
- **Correction, found while writing this update:** the customer/entity correlation layer this paragraph was about to call missing already exists and already ships. `correlateFindingsByName` (`packages/intelligence/src/finding-correlation.ts`) groups findings sharing the same real, normalized `correlationName` — populated today by `overdue-invoice.ts` (customer name), `lead-risk.ts`/`ownership.ts` (company name), `ticket-risk.ts` (requester name), and `message-follow-up.ts` (counterparty name) — and `dashboard-composition.ts` already threads the result into each `IntelligenceCard.relatedFindingIds`, rendered today as a small "+N related" badge (`card-shell.tsx`). Its own doc comment is explicit that this is deliberately "a hint, never a merge" — correlated findings stay fully separate, independently evidenced records, the same anti-auto-merge discipline this repo applies to entity data generally. So the Desk Triage Engine's core grouping rule ("if an overdue invoice, a stalled task, and an unread email share the same customer... group them into ONE Matter") is not a research question — the matching primitive is real, tested, and already live; only `overdue-task.ts` doesn't populate it (Asana tasks carry no customer/company name field to correlate on, which is an honest data gap, not a missed wiring).
- **Still genuinely missing, load-bearing for the full pipeline:** ~~any persisted multi-step plan state~~ — partially resolved, see the fifth real slice below (still not a general `Mission`/DAG schema: `agent_investigation_steps` only tracks `parallel_specialists` investigations, not an arbitrary resumable plan); any background/async execution (no job runner — see the Zero-Prompt AI entry above, same gap); any UI that presents a correlated group as one collated Matter rather than N separate cards each carrying a small badge (the presentation this session actually built, immediately below); a dry-run/simulation engine (nothing sandboxes a mutation's effect before proposing it — today "safe" means "never auto-executed," not "simulated first"); and the Pre-Flight Auditor's own invariant checks (refund-approval limits, PII-leak scanning, domain-allowlist verification) — real, worth building, but net-new policy logic, not a wrapper around anything that exists.
- **Real slice built same day, this session:** since the correlation data was already real, the honest next step was presentation, not new detection logic. `command-center-board.tsx` now groups the existing `relatedFindingIds` into visual clusters (`groupCardsIntoClusters`) rendered together under a "Possibly the same situation" header, in place of the old scattered per-card "+N related" badge alone — still N fully independent cards underneath, no merge, no new schema.
- **Second real slice built same day, this session (ADR 0058):** the Pre-Flight Compliance & Policy Auditor. Given a choice between the Auditor, a persisted Mission/plan schema, and the Work Mat UI, the user picked the Auditor as the smallest, safest real slice — and it turned out to need zero new schema at all. `runPreFlightPolicyAudit` (`apps/web/app/_lib/pre-flight-policy-audit.ts`) now runs inside all five existing draft-then-approve write actions, checking three real things: an injection-boundary delimiter leaking into drafted content, a drafted dollar figure that doesn't match the real amount on record (QuickBooks invoice reminders, HubSpot deal notes with a real deal value), and a duplicate send to the same entity within 24 hours (a new read-only query against each connector's own existing send-tracking table). Refund ceilings and a recipient-domain allowlist stay out of scope — see ADR 0058's own "explicitly out of scope" section for why neither has anything real to check against yet.
- **Third real slice built same day, this session (ADR 0059):** the Resilience & Self-Healing Agent — its honest, buildable-now half. `UpstreamProviderError` gained a real `status`/`retryAfterSeconds`, previously discarded entirely (every connector failure carried the same generic message no matter what the provider actually returned). `classifyRecoveryStrategy` (`apps/web/app/_lib/recovery-strategy.ts`) now turns that into one of five specific, honest messages ("reconnect," "rate-limited, try again in ~N minutes," "may have changed, refresh," "could not be found," or the original generic fallback) surfaced by all five approve actions on a real failure. What's explicitly not built, per ADR 0059: any automatic retry at all — this app still has no background job runner, so "self-healing" here means a better message, never an autonomous action.
- **Fourth real slice built same day, this session (ADR 0060):** "Draft for this Matter" — the smallest real instance of "Chief of Staff coordinates sub-specialists" that didn't need a plan schema or a new agent. A Matter group of 2+ related cards now gets one "Draft for all N" button that calls each card's own existing single-entity draft action in parallel, landing every result as its own independently-approved `agent_recommendation` card — pure client-side batching over five already-real actions, no new write path. The clustering/dispatch logic was also extracted out of `command-center-board.tsx` into a tested module (`apps/web/app/_lib/card-clustering.ts`). A live-verification pass (real browser, real seeded data in the dev database) caught a real duplicate-draft bug the same day — two different findings on one entity (a lead with both `follow_up_risk` and `ownership_gap`) fired the same draft action twice — fixed via `dedupeCardsByEntity`/`getBatchDraftableCards`; see ADR 0060's own update for the full account.
- **Fifth real slice, a later session (ADR 0063): the Work Mat, resolving the one real conflict this entry itself flagged above.** A separate proposal arrived for a freeform `AutonomousChiefOfStaff` (a DAG-planning engine dynamically selecting connector tools, backed by a new `agent_sessions`/`agent_plan_steps`/`agent_action_proposals` schema) plus a raw per-tool "Reasoning Stream" UI — surfaced directly rather than built, since it would have stood up a second, looser, parallel mutation-and-planning system next to the one this repo keeps hardening, and the reasoning-stream UI was exactly the named-specialist-identity leak this entry's own bullet above says ADR 0020 forbids. Given the choice, the user chose to extend the existing system rather than build the parallel one. What actually shipped: `agent_investigation_steps` (migration 0066), an ordered child table of `agent_collaborations`, written incrementally as `runParallelSpecialists` genuinely progresses (a new optional `onSpecialistSettled` callback fires the moment each domain's own dispatch settles); a client-generated investigation id so the UI can poll `GET /api/agents/investigations/[id]/steps` from the instant the command fires, since the triggering Server Action still only returns once, at the end; and a real step list in `command-center-board.tsx` showing plain business-language labels ("Checking overdue invoices…", "Reconciling findings…") — never a tool name, connector identifier, or which of the two `AGENT_REGISTRY` specialists ran. That label discipline is the concrete mechanism translating "operator sees real progress" into ADR 0020's terms without the swarm-visibility this entry warned against, exactly the re-expression this entry called for. Still not built: the freeform DAG planner and the generic action-proposal schema (the five existing per-connector draft-then-approve actions remain this repo's real action-proposal pattern). Step-tracking for `single_specialist` collaborations (draft actions) — the one gap this entry named as the natural next extension — is done as of ADR 0063's own 2026-08-26 update: `DraftActionButton` (the shared button behind all five "Draft note/nudge/reply/reminder" controls) now generates its own draft id and polls the same `agent_investigation_steps` table, showing two real steps ("Loading context…", a connector-specific "Drafting X…") rather than a mechanical copy of the investigation's three-domain shape. Not extended to the batch "Draft for this Matter" trigger's live UI (ADR 0060) — it generates a real draft id per dispatched entity too, but there's no single-card view to show per-entity progress in when several draft in parallel, and building one was judged disproportionate to what this extension asked for.

## "Next-generation" agent prompts — 10 more (captured 2026-08-24, unscoped)

A second, later batch in the same Devin/BizOps vein as the "AI Business Operator" entry above: a root-cause autopsy tracer, a financial dry-run simulator, a scope-creep/SOW auditor, a client-churn sentiment radar, a calendar/meeting dispatcher, a dynamic API tool-synthesizer built on MCP, a cross-session organizational-memory/playbook synthesizer, a SaaS-procurement cost-killer, an SLA escalation gatekeeper, and an end-of-day workspace reconciler.

**Reality check, fast, since the pattern by now is well-established**: two of the ten already have a real, narrower existing analog, worth knowing before designing anything new. (1) The "financial simulator" — `simulateInvoicePaymentAction`/"What if this gets paid?" (ADR 0031) already does a real, deterministic, read-only dry-run for exactly one scenario (a single invoice's payment) against real data; a 30/60/90-day cash-flow projection across three ledgers is a much bigger, genuinely new capability, not an extension of that one. (2) The "end-of-day reconciler" — Daily Brief and Since-You-Left Brief (`generate-daily-brief.ts`/`generate-since-you-left-brief.ts`) already assemble real findings into exactly this kind of summary on demand; what's missing is only the _autonomous, unprompted, end-of-day-triggered_ part, which needs the same background job runner every other "do this automatically on a schedule" idea in this file has been blocked on since the Zero-Prompt AI entry.

**One item conflicts directly with an already-settled decision, not just an infrastructure gap**: the "Dynamic API Tool-Synthesizer & MCP Orchestrator" proposes building against MCP — this repo's own certification (`SIGNALDESK_SYSTEM_CERTIFICATION.md`) has independently confirmed, more than once, "there is no MCP or A2A surface and nothing external can reach this app's agent layer today," named as a deliberate, disclosed absence each time, not an oversight. Building it now would also mean an agent constructing and executing genuinely ad-hoc API calls against arbitrary schemas at runtime — a materially different, harder-to-govern trust boundary than every real write this app has today (five fixed, individually-reviewed, individually-coded connector actions, never a model-authored request shape). Not scoped, not started.

**The other seven are each blocked on a real, specific, already-named infrastructure gap, not vague unreadiness**: root-cause autopsy and SLA-breach projection both need a cross-tool event timeline this app doesn't persist (today's audit trail records this app's own actions, not a reconstructable multi-system causal chain); the churn radar and SLA velocity projection both need historical/trend data this app has never stored (the same gap the Goal Intelligence Engine's own `ON_TRACK` status can't produce, for the identical reason); the scope-creep auditor needs DocuSign, which is catalog-only with every readiness flag `false`; the calendar dispatcher needs real write actions to Google Calendar/Microsoft Outlook, both read-only today; the playbook synthesizer needs a semantic-memory store and "Work Mat sessions," neither of which exist; continuous SLA/procurement monitoring needs the same background job runner named above, twice over. None of these are close enough to existing architecture to build a small real slice from today — recorded here so the ideas aren't lost, not designed further ahead of the infrastructure they all actually depend on.

## A third batch of 10 specialist agent prompts (captured 2026-08-26, unscoped)

A third round in the same vein as "AI Business Operator" and "'Next-generation' agent prompts" above, arriving mid-session while this session's actual focus was production-readiness hardening, not new capability scoping: a revenue-ingestion/lead-routing specialist, a treasury/FX reconciler, a retainer/contract-lifecycle guardian, a compliance/PII auditor, a vendor-negotiation drafter, a team-burnout/workload rebalancer, an executive QBR/client-report generator, a crisis-management dispatcher, an integration-migration/schema-mapper, and a Voice-of-Customer synthesizer. Framed with four "industry pattern" claims (policy-as-runtime-contract, idempotency keys, async non-blocking human-in-the-loop, ≤10-tool sub-agent budgets) presented as settled practice ahead of the ask — this repo's own existing patterns (the Pre-Flight Policy Audit, `idempotencyKey` columns already on `agent_collaborations` and every connector send-tracking table, the fixed two-entry `AGENT_REGISTRY`) already satisfy the spirit of most of these, so they argue for extending what exists, not for the 10 new named personas that followed.

**Reality check, same discipline as the prior two batches — checked against real architecture, not assumed blocked:**

- **One real, buildable extension exists**: the Executive QBR/Client Report generator. `generateDailyBrief`/`generateSinceYouLeftBrief` (`@signaldesk/application`) already assemble real, evidence-backed findings into a structured summary on demand — a QBR is a longer time-window, client-facing variant of the same real pattern, not a new mechanism. The others are each blocked on a specific, already-named, real gap:
- **Needs a connector that doesn't exist yet**: Retainer & Contract Lifecycle Guardian needs DocuSign, still catalog-only with every readiness flag `false`.
- **Needs content-sync this app deliberately doesn't have**: the Compliance/PII Guardian and the VoC Synthesizer both need Slack message content — Slack is identity-only today (`channels:read`, not `channels:history`), a deliberate scope boundary from ADR 0050's Gmail-vs-Slack comparison, not an oversight.
- **Needs data this app has never modeled**: the Treasury/FX Reconciler needs multi-currency amounts — Salesforce's connector explicitly discloses a USD-only simplification this session, and no other connector models currency at all; building real FX exposure tracking means extending that simplification everywhere first, a materially bigger project than this one prompt implies. The Burnout/Workload Rebalancer needs utilization/after-hours/meeting-ratio trends — the same historical-snapshot gap Goal Intelligence's own `ON_TRACK` status is already blocked on.
- **Needs a background job runner**: the Crisis Dispatcher's "live crisis timeline" and continuous monitoring both need the same always-missing scheduled/async execution layer every "do this automatically" idea in this file has been blocked on since the Zero-Prompt AI entry.
- **Needs a materially new, higher-risk capability, not an extension**: the Integration Migration/Schema Mapper would map one provider's schema directly onto another's (this app has only ever mapped provider → its own canonical schema, never provider → provider) — a genuinely different, unscoped capability. The Compliance Guardian's "redact flagged content from local sync indexes" is a new kind of write this app has never had — mutating/erasing already-ingested data outside the existing append-only provenance model — which sits squarely inside CLAUDE.md's top priority (data integrity) and deserves its own deliberate design, not a bullet inside a larger prompt.
- **Partially real, partially net-new**: the Revenue Ingestion/Lead Routing Specialist's HubSpot/Salesforce reads are real; ICP scoring, AE-capacity-aware routing, and a new "assign to AE" write action are not. The Vendor Communications Negotiator's QuickBooks/Gmail reads are real and its draft-then-approve shape matches the existing 5 write actions structurally; "citing historical SLA breaches" and invoice line-item-level detail need data this app doesn't track at that granularity today.

Not started. Recorded so the ideas aren't lost, per this file's own stated purpose — the actual next real step, if any of these get prioritized, is the QBR extension (the one with a genuine existing analog), not the other nine.

## How to use this file

When ready to prioritize any one theme, treat it the same way `BusinessSnapshot` and the privacy/data-lifecycle work were handled this session: pick one narrow, real, end-to-end slice (schema if needed, real service, real tests, live verification), not the whole layer at once. This file is where to look for the next candidate — not a queue to work through in order.
