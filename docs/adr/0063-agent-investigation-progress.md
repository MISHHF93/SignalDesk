# ADR 0063: Agent investigation progress — an amendment to ADR 0020

- Status: Accepted
- Date: 2026-08-25
- Amends: ADR 0020 (Agent Fabric)

## Context

Today, "investigate risk" in the command bar
(`runAgentInvestigationAction`) is one synchronous Server Action call: the
client submits, the whole fan-out/reconcile pipeline runs server-side with
no intermediate visibility at all, and the client only ever learns
anything once the entire investigation is done — the command bar shows a
generic "Asking…" the whole time, identical to every other command.

A design-revamp initiative (this session) asked for a "Devin-style"
interactive execution view: real, incremental, step-by-step visibility
into what an investigation is doing while it runs, not just its final
result. That request sits in direct tension with ADR 0020's own explicit
design principle — "one AI, never a visible swarm" — and its closing
statement that the next real step toward the wider Agent Fabric vision is
"a second real specialist capability... not a bigger type system," i.e.
a deliberate choice to keep the specialist _count_ fixed and grow only
_capabilities_.

A separate, larger proposal arrived in the same window: a freeform,
dynamically-planning `AutonomousChiefOfStaff` that would invoke Claude to
produce its own DAG of steps and dynamically select connector tools per
step, backed by a new, independent `agent_sessions`/`agent_plan_steps`/
`agent_action_proposals` schema, with a raw "Reasoning Stream" log of
tool invocations in the UI. That would have stood up a second, looser,
parallel mutation-and-planning system next to the one this repo has
built and repeatedly hardened (capability-routed, fixed two-specialist
`AGENT_REGISTRY`; narrow per-entity-type FKs on `agent_collaborations`
rather than generic JSON payloads; `canExecute` permanently `false`). This
was surfaced directly and the decision was to extend the existing system
rather than duplicate it — this ADR records what "extend" means
concretely.

## Decision

**No new session concept.** `agent_collaborations` already _is_ the
session record (`status`, `outcome`/`reviewedAt`, `idempotencyKey`,
narrow per-entity FKs) — nothing here introduces a parallel
`agent_sessions` table.

**One new child table, `agent_investigation_steps`** (migration 0066):
an ordered, real, incrementally-written progress record —
`step_index`, `label`, `status` (`pending`/`running`/`done`/`failed`),
`started_at`/`completed_at` — FK'd to `agent_collaborations` the same way
`agent_task_results`/`agent_delegation_grants` already are. Same
forced-RLS/tenant-policy/least-privilege-grant treatment as every
existing Agent Fabric table (0034's own template), including an update
policy since a step's status genuinely transitions after creation.

**`label` is always a plain business-language sentence** ("Checking
overdue invoices…", "Reconciling findings…") — never a raw tool name,
connector identifier, or specialist/model identity. This is the concrete
mechanism that keeps the new visibility inside ADR 0020's "one AI, never
a visible swarm" constraint: the client sees one agent identity's own
steps, never which of the two `AGENT_REGISTRY` entries ran, never a
raw tool-call/reasoning transcript. There is no "Reasoning Stream."

**Steps are declared for real work only.** `runAgentInvestigationAction`
builds the step list from which domains actually have real findings to
check (mirroring `runParallelSpecialists`'s own no-fabricated-work
doctrine) — a step never appears for a domain with nothing to
investigate, and a domain with findings but no eligible agent still
settles its step (as `failed`) rather than leaving it stuck at
`pending` forever.

**`runParallelSpecialists` gains one optional callback**
(`onSpecialistSettled`), fired the instant each domain's own dispatch
settles — independent of the other two, since they genuinely run
concurrently and can finish at different real times. Purely
observational: `packages/application` still takes no persistence
dependency of its own, and every existing caller that omits the
callback sees identical behavior to before this ADR.

**No new transport.** The client generates the investigation's own id
(`crypto.randomUUID()`) before calling the Server Action, so it can
start polling a new read-only route
(`GET /api/agents/investigations/[id]/steps`) the instant the command
fires — this is the one new mechanism required, since a Server Action
only ever returns once, at the end, and had no earlier moment to hand an
id back. Polling reuses `useBusinessSnapshot`'s already-established
plain-interval pattern, not a new WebSocket/SSE transport. The poll route
never returns the final card — only step/status — the client's own
awaited action result is still the sole source of truth for the
reconciled recommendation, exactly as before this ADR.

**The fixed, two-specialist, capability-routed model is unchanged.**
`AGENT_REGISTRY` still has exactly two entries; `selectAgent` still
routes by declared capability, never a hardcoded provider name; no
dynamic tool selection, no LLM-authored DAG plan, no generic
`input_payload`/`output_payload` JSON blob replacing the narrow,
per-entity-typed columns this schema uses everywhere else.

## Explicitly out of scope

The freeform `AutonomousChiefOfStaff` dynamic-planning engine, a
generic `agent_action_proposals` table (the existing per-connector
draft-then-approve Server Actions — invoice reminders, task nudges,
deal notes, ticket replies, message replies — already are this repo's
action-proposal pattern, narrowly typed per connector rather than one
generic shape), and any raw tool-call/reasoning-transcript UI. A future
initiative may reconsider any of these, but each would need its own
ADR weighing it against the narrower, already-hardened patterns this one
extends.

## Consequences

"Investigate risk" gains real, honest, incremental progress — a
genuine Devin-style step list — without adding a second mutation
pathway, without weakening the narrow per-entity-typed schema discipline
this repo has used since its earliest Agent Fabric migration, and
without showing the user anything ADR 0020 asked to keep invisible. The
next real step, if this is prioritized further, is applying the same
step-tracking table to `single_specialist` collaborations (draft actions)
rather than only `parallel_specialists` investigations — not a bigger
schema.
