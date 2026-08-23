# ADR 0028: `evaluatePolicy` — first real slice of the Control Plane

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 11 proposed a full `SignalDesk
Control Plane`: a unified `ControlPlane`/`PolicyRule`/`PolicyVersion`/
`PolicyEvaluation` engine that every consequential operation is evaluated
through, `ALLOW`/`DENY`/`REQUIRE_APPROVAL`/`REQUIRE_REAUTH`/
`REQUIRE_MORE_EVIDENCE`/`DEFER` decisions, tenant budget policies, a
Policy Center UI, emergency kill switches, and policy simulation. That
entry's reality check found two real, narrow precedents already doing a
version of this at their own single call site — `AgentGatewayService`'s
capability-escalation check (`apps/web/app/_lib/agent-gateway.ts`, ADR 0020) and `canAddActiveConnection`'s entitlement check
(`packages/persistence/src/subscriptions.ts`) — but no shared abstraction
between them: each hand-rolled its own inline boolean check.

Building the full proposed engine now would mean designing
`PolicyRule`/`PolicyVersion`/a Policy Center UI/budget policies from a
sample size of exactly two real enforcement points, most of which
(versioning, simulation, a UI) have nothing real to version, simulate, or
configure yet. The same premature-generalization risk this session's
other ADRs (Business Profile, VisualStateResolver, Decision Intelligence)
have each avoided on purpose.

## Decision

**One pure, deterministic function — `evaluatePolicy`** (`packages/domain/src/index.ts`)
— takes a typed `PolicyRequest` union and returns a `PolicyDecision`
(`{ outcome: "allow" | "deny", reason: string }`). No IO, no async, no
side effects: exactly the same "capabilities produce evidence, not
mutation" discipline this codebase's `IntelligenceCapability`s and
`generateDailyBrief` already follow.

**Lives in `@signaldesk/domain`, not `@signaldesk/application`.** The two
real callers sit on different sides of the dependency graph —
`packages/persistence` (which `canAddActiveConnection` lives in) cannot
depend on `@signaldesk/application` without inverting the dependency
direction (`domain` → `schemas` → `persistence`/`intelligence` →
`application` → `apps/web`). `@signaldesk/domain` is the one package
both real callers already depend on, directly or transitively, so it's
the correct home for anything genuinely shared between them — not a
convenience choice, a constraint the dependency graph itself imposes.
(`apps/web` was missing a _direct_ dependency on `@signaldesk/domain`
despite importing its types transitively through
`@signaldesk/application`/`@signaldesk/persistence` already — a real
phantom-dependency gap this ADR also closes, since the new direct
`evaluatePolicy` import made it visible.)

**Two real call sites now route through it, with zero external behavior
change.** `canAddActiveConnection` still returns a plain `boolean` — no
caller needed to change. `AgentGatewayService.dispatch` still throws the
same `CapabilityEscalationError` on denial. The only change either
caller's _behavior_ undergoes is that the actual decision logic now lives
in one tested, shared place instead of two independent inline checks that
could silently drift apart.

**Only `ALLOW`/`DENY` for now.** `REQUIRE_APPROVAL` already exists as a
concept elsewhere in this app (the agent-recommendation approve/dismiss
flow, ADR 0020/0027) but isn't threaded through `evaluatePolicy` yet —
adding it here would mean guessing at a shape before a caller actually
needs `evaluatePolicy` to express it. `REQUIRE_REAUTH`/
`REQUIRE_MORE_EVIDENCE`/`DEFER` have no real caller at all yet.

## Explicitly out of scope

`PolicyRule`/`PolicyVersion`/`PolicyEvaluation` persistence, versioning,
or audit history — `evaluatePolicy` is a pure function call, not a
governed, database-backed policy engine. A Policy Center UI — there is
nothing configurable yet for an administrator to see. Policy simulation
("what would happen if..."), since simulating a two-case switch statement
adds no value a code read doesn't already give. Budget policies,
`ModelPolicy`, `ConnectorPolicy`, `AgentPolicy`, `ActionPolicy` as
distinct concepts — folded into the same `PolicyRequest` union the day
each gets a real enforcement point, not modeled speculatively now.
Emergency kill switches beyond the one that already exists
(`AGENT_FABRIC_ENABLED`) — not migrated into this abstraction, since it
gates an entire feature rather than making a per-request decision.

## Consequences

Two real, previously-independent enforcement checks now share one tested,
deterministic decision function, and the pattern is proven: the next real
policy decision this app needs (a third `PolicyRequest` variant) has
somewhere real to go rather than a third hand-rolled inline check. The
full Control Plane vision remains logged in `docs/product-vision-backlog.md`
as exactly that — a vision, not infrastructure built ahead of the
concerns that would justify it.
