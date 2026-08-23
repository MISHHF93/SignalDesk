# ADR 0045: Cost & Performance Optimizer — the first real cost-event write

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 36 (Cost & Performance
Optimizer) proposed an `IntelligenceEconomicsEngine` recording real
cost/latency/quality per computation path, per-tenant budgets, model
routing, and duplicate-investigation avoidance, with
`cost_per_useful_signal`-style metrics.

The reality check named the first real step precisely: `internal_cost_events`
is real DDL (migration 0022), but nothing in the codebase ever wrote to
it — instrument the one real model-calling path
(`claude-provider.ts`, via `AgentGatewayService`) to write a real row per
invocation, "the minimum real data point every other metric this
proposal names would derive from," before building budgets, routing, or
dashboards on nothing.

**Correction to the reality check's own framing, found while starting
this work**: `packages/persistence/src/internal-cost-events.ts` already
existed, with a real, working `recordInternalCostEvent` and a real
`getInternalCostSummary` aggregation query — genuine, tested-shape
plumbing, just never called by anything (its own doc comment already
said so). This ADR did not need to build that plumbing from scratch; it
needed to wire the one real caller and slightly strengthen the writer
(a `void` return became a real `InternalCostEvent` return, useful for
tests and future callers) — extending existing architecture, per
`CLAUDE.md`'s own instruction, not replacing it.

## Decision

**`AgentGatewayService.dispatch()` now writes a real cost event for
every real Claude invocation.** `apps/web/app/_lib/agent-gateway.ts`'s
`recordOutcome` calls `recordInternalCostEvent` with `eventType:
"claude_specialist_invocation"` whenever `agent.provider === "anthropic"`
— the schema-typed discriminator (`AgentCard.provider: "deterministic" |
"anthropic"`, `@signaldesk/schemas`) already distinguishes the real
model-backed specialist from the always-available deterministic one,
so no string-literal agent-id check was needed.

**Precise about when a real cost was actually possible.** A new
`providerCallAttempted` flag, set only immediately before
`generateStructured()` is actually called, gates the cost-event write
alongside the provider check. Without it, a policy-denied task
(`CapabilityEscalationError`, thrown _before_ the provider is ever
reached) or a grant-minting failure would have recorded a cost event
for a call that never happened — a real correctness bug this review
caught before shipping, not a hypothetical one: `recordOutcome` is
called from both the success path and the catch-all failure path, and
the failure path covers both "the provider call itself failed" and
"the task was rejected before reaching the provider" with no prior
distinction between them.

**Honestly null, not fabricated, cost.** No per-token Anthropic pricing
table exists anywhere in this codebase. Getting a real dollar figure
would mean either hardcoding external pricing (a number this repo can't
verify and that changes independently of any code change here) or
threading real token-usage counts out of the Anthropic SDK response
through the `AIProvider` interface — a real, bigger interface change
(`generateStructured<T>(): Promise<T>` would need to become something
like `Promise<{ value: T; usage: TokenUsage | null }>`, rippling into
every implementation and the Command Bar's unrelated
`parse_dashboard_command` caller) that the reality check's own framing
("the minimum real data point") didn't ask for. `estimatedCostCents`
stays `null`; `metadata` instead carries what's genuinely available
today without inventing anything: `agentId`, `capability`,
`outcome`, `latencyMs`.

**Tested.** 6 new live-database tests
(`packages/persistence/tests/internal-cost-events.test.ts`, none
existed before) covering a real write with null cost, a write with a
caller-supplied quantity/cost, the database's own blank-event-type
check constraint, tenant isolation, real aggregation by event type, and
date-range exclusion. Full persistence suite (310 tests) re-run against
the real Supabase dev project.

## Explicitly out of scope

Per-tenant budgets, model routing, duplicate-investigation avoidance,
and any dashboard or `cost_per_useful_signal` metric — all still need
real cost data to accumulate first, which is exactly what this slice
starts producing and none of them had before. Real dollar-accurate
costing (would need the `AIProvider` interface change described above).
Instrumenting connector sync as a second cost-event source — the
reality check named the one real model-calling path specifically; sync
jobs already have their own real observability (`sync_jobs`, ADR 0021)
that already records the operationally-relevant facts (items
ingested/skipped, duration) a sync run needs.

## Consequences

`internal_cost_events` now has a real, if still simple, data stream
behind it — the first real evidence, not zero, for any future budget or
routing decision. Live verification of the actual write firing in this
environment was not possible: neither `ANTHROPIC_API_KEY` nor
`AGENT_FABRIC_ENABLED` is configured here, so the Claude specialist
never actually dispatches (per ADR 0020, an investigation with the
Agent Fabric off, or with no API key, resolves entirely to the
deterministic specialist, which correctly never writes a cost event).
Verified by the 6 new live-database tests against the write/read
functions directly, plus monorepo typecheck and build — not a live
Playwright trigger of a real Claude call, which no credential in this
environment could produce. Disclosed here rather than claimed as
end-to-end tested.
