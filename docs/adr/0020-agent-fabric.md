# ADR 0020: Agent Fabric — governed multi-agent collaboration

- Status: Accepted
- Date: 2026-08-19

## Context

A detailed proposal arrived for a "SignalDesk Agent Fabric": a governed
trust-boundary gateway, an agent registry/directory, structured task
delegation, parallel specialists reconciled into one recommendation,
capability-scoped grants, kill switches, and full audit — while keeping the
customer-facing experience "one AI," never a visible swarm.

`docs/product-vision-backlog.md` had already logged this exact proposal one
day earlier and flagged it unscoped, with a documented reality check: zero
AI model providers existed anywhere in this codebase. The only `AIProvider`
implementation was a deterministic keyword matcher (`deterministic-provider.ts`);
no vendor SDK, no model API call, no agent runtime, and no
governance/permission concept beyond human org membership existed in any
package. That reality check's own conclusion: "real sequence: single real
provider → real usage/evals → only then does routing between providers
become a real question."

The tradeoff was surfaced directly, and the decision was to build the full
fabric now anyway — but honoring this repo's own strict discipline against
"types nothing reads": every piece had to be real and reachable end to end,
not scaffolding waiting on a paid key.

## Decision

**One real model-backed `AIProvider`** (`claude-provider.ts`,
`packages/application/src/ai/`) using `@anthropic-ai/sdk`, gated behind
`ANTHROPIC_API_KEY` (unset ⇒ inert, same convention as every connector
credential). Defaults to `claude-haiku-4-5` — a narrow, bounded JSON
interpretation task over a handful of already-computed findings, not
open-ended agentic work.

**The deterministic provider gains an `interpret_findings` case**
(`deterministic-provider.ts`), templating claims directly from real
findings with zero network calls. This is what makes
`AGENT_REGISTRY` (`agent-card.ts`) a genuine two-specialist catalog
(`claude-specialist`, `deterministic-specialist`) usable with zero external
credentials, not a single real agent plus a stub.

**A static agent registry, a capability-based router, a parallel-specialist
coordinator, and a result reconciler** — all in
`packages/application/src/agents/` — mirror the existing
`IntelligenceCapability`/`runIntelligenceCapabilities` pattern
(`@signaldesk/intelligence`): agents produce evidence, never a UI decision;
`reconcileSpecialistResults` merges/dedupes/flags contradictions and
extends `confidence.ts`'s one-constant stub into a real
`combineSpecialistConfidence` combination rule; a malformed result citing
evidence it was never given is dropped, not trusted. `packages/application`
gains one new dependency (`@anthropic-ai/sdk`) but no dependency on
`@signaldesk/persistence` — the actual trust boundary that needs persisted
state lives at the app layer, matching every other persistence-orchestration
in this app (`getTodaysAttention`, `generate-daily-brief.ts`).

**`AgentGatewayService`** (`apps/web/app/_lib/agent-gateway.ts`) is the real
trust boundary: rejects a capability the agent never declared, mints a
time-bounded capability grant (`agent_delegation_grants`), calls the real
provider, and persists both an `agent_task_results` row and an
agent-attributed `audit_events` row (`actor_kind = 'agent'`) — whether the
call succeeded, failed, or was denied.

**Database** (migration 0034): three new tenant tables
(`agent_collaborations`, `agent_task_results`, `agent_delegation_grants`),
same forced-RLS/least-privilege-grant treatment as every existing tenant
table. `audit_events.actor_kind` widens to include `'agent'`, with a new
`actor_agent_id` column and a three-way consistency check —
`insertAuditEvent()` previously hardcoded `actor_kind = 'user'` in its SQL;
that hardcoding is now a real, tested branch. The forward-designed
`signals`/`recommendations` tables were **not** reused: both are hard-FK'd
to a specific `leads.id`, and an Agent Fabric collaboration is cross-entity
by design (real overdue-invoice findings alongside real overdue-task
findings) — reusing them would have meant corrupting that FK or fabricating
a fake lead.

**The one real end-to-end slice**: "investigate risk" in the command bar
(`matchAgentInvestigate`, distinct from the existing `/^why\b/i`
per-card-focus intent) re-derives real current findings via
`getTodaysAttention` (never client-trusted state), fans out to a finance
specialist over real `invoice.overdue` findings and a delivery specialist
over real `task.overdue` findings — excluding whichever agent finance
picked, so the two domains genuinely run on different backends whenever
more than one specialist is eligible — reconciles the results into one
`agent_recommendation` card through the **existing, unmodified**
`prioritizeFindings`/`composeCards` pipeline, and, if a recommendation
survives, gates its one proposable action (`create_internal_task`) behind a
real Approve/Dismiss control that reuses the **existing, unmodified**
`createInternalTask` — no second write path.

**Two kill switches, deliberately not more**: `AGENT_FABRIC_ENABLED` (the
real feature flag; off ⇒ the investigation action never touches the
database or a provider, and every existing deterministic path is
untouched) and the existing `ANTHROPIC_API_KEY` "unset ⇒ inert" convention
(on with no key ⇒ both specialists run on the deterministic provider —
real, zero-cost, fully exercised).

**Admin-only Agent Directory + Collaboration Trace** (`/agents`,
owner-gated) — per the Application Surface Model, this is
administration/configuration, not the daily one-page surface. No
customer-facing surface ever shows per-specialist detail; the command
center only ever sees the one reconciled card.

## Explicitly out of scope

Literal A2A or MCP wire-protocol compliance (interop with real external
agents/tool servers) — the internal shapes (`AgentCard`, `AgentTask`,
`AgentTaskResult`) are conceptually A2A-shaped so a real protocol adapter
could later sit behind them, but nothing here speaks the wire protocol. A
third-party agent marketplace, certification pipeline, or agent publishing.
A2UI / agent-generated UI. OpenTelemetry instrumentation — this reuses the
existing audit-event pattern instead. Any second or third real model vendor
(OpenAI, Gemini) with real credentials wired in — the provider seam is
vendor-agnostic by construction, but only one real adapter exists.
`canExecute` remains hard-`false` for every registered agent: no agent may
ever execute a business mutation directly, only propose one through the
existing approval gate.

## Consequences

The Agent Fabric is real end to end with zero external credentials — every
piece (routing, parallel dispatch, reconciliation, contradiction detection,
capability grants, audit, approval) is reachable and tested today, and
becomes genuinely dual-backend the moment `ANTHROPIC_API_KEY` is set. The
next real step toward the wider Agent Fabric vision (`docs/product-vision-backlog.md`),
if and when it's prioritized, is a second real specialist capability with
real data behind it, or a real second model vendor — not a bigger type
system.
