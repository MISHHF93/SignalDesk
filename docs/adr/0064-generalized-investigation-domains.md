# ADR 0064: Generalized investigation domains — a deliberate amendment to ADR 0020/0063

- Status: Accepted
- Date: 2026-08-26
- Amends: ADR 0020 (Agent Fabric), ADR 0063 (Agent investigation progress)

## Context

A large, unsolicited proposal arrived mid-session for a "Chief of Staff"
dynamic-DAG orchestration engine, a "Worker Swarm" of domain-bounded
specialists, an MCP-based dynamic tool-router, and a raw reasoning-log UI
— materially the same shape of proposal ADR 0063 already declined once
this session, and one this repository's own `SIGNALDESK_SYSTEM_CERTIFICATION.md`
has independently, repeatedly confirmed has no real surface here (no MCP,
no A2A, no worker-swarm identity model). It was surfaced directly rather
than built; the user, having already chosen "extend the existing system"
once this session, was asked again given the scale of what was proposed,
and chose a narrower, real slice: extend the existing orchestration
mechanism to cover more real domains, using only the 14 connectors already
real, with no new connector, no new schema, and no third-party account —
explicitly ruling out the schema (`agent_sessions`/`agent_plan_steps`/
`agent_action_proposals`), the freeform planner, and the MCP surface.

This ADR records what "extend" means concretely, and is a genuine,
deliberate amendment: it reverses one specific piece of ADR 0063's
"not a bigger type system" doctrine (the investigation domain _count_),
while keeping everything else that doctrine protects fully intact.

## Decision

**The investigation domain set is no longer hardcoded to exactly three.**
`runParallelSpecialists` (`packages/application/src/agents/parallel-specialist-coordinator.ts`)
previously took three fixed positional parameters (`financeInput`,
`deliveryInput`, `ticketInput`) with the exclusion-preference/fallback
logic for each written out by hand. It now takes a single
`readonly SpecialistDomainRequest[]` — each entry a plain
`{ domain, capability, objective, findings }` record — and applies the
identical best-effort-exclusion/fallback logic in a loop, accumulating
already-assigned agent ids across however many domains are given. This
was a pure internal generalization: every existing behavioral guarantee
(a domain with no findings contributes nothing; a domain with findings but
no eligible agent settles as `null`, never fabricated; one domain's
dispatch failure never blocks another's; `onSpecialistSettled` fires the
instant each domain's own dispatch settles) is unchanged and re-verified
by the existing test suite, extended rather than rewritten.

**Two new real domains, using only what already exists.** `interpret_lead_risk`
and `interpret_goal_variance` are added to `AgentCapability`
(`packages/schemas`) and to both `AGENT_REGISTRY` cards — the specialist
_count_ stays at exactly two, matching ADR 0020's own doctrine ("a second
real specialist capability... not a bigger type system") applied to this
one additional pair. Both new capabilities route through the _same_
already-generic `interpret_findings` task in both providers
(`claude-provider.ts`/`deterministic-provider.ts`) — neither provider
needed a single line of new prompt or business logic, since that task was
already parameterized by capability and a plain `IntelligenceFinding[]`,
never hardcoded to financial/delivery/ticket concepts. This is why the
change was safe to make without a real `ANTHROPIC_API_KEY`: the
deterministic path's behavior for the two new domains is exercised by the
exact same code path already covering the original three, not a new,
untested branch.

**The domain-to-finding-type mapping is app policy, not mechanism.**
`run-agent-investigation.ts` (`apps/web`) owns a real, data-driven
`INVESTIGATION_DOMAINS` registry — one entry per domain naming its real
finding type (`lead.follow_up_risk`, `goal.at_risk`, alongside the
original `invoice.overdue`/`task.overdue`/`ticket.stuck`), its capability,
its Work Mat step label, and its objective sentence. `packages/application`
knows nothing about what any domain string means; it only executes
whatever list it's handed. Adding a future domain (were one to become
real) is a new entry in that one list, never a change to the coordinator.

**Two domains, not all nine registered `IntelligenceCapability`s, and
deliberately so.** `integration-health`, `ownership-gap`, and
`payment-received` are operational/factual signals, not something an AI
specialist meaningfully "interprets" as business risk; `message-follow-up`
already has its own dedicated single-entity draft flow (Gmail reply),
structurally separate from this parallel-sweep investigation. Only
lead-risk and goal-variance are genuine, well-justified additions to _this_
mechanism today — adding the others here would be scope inflation with no
real interpretive value behind it, not a genuine extension.

**Title-building generalized the same way.** `agent-result-reconciler.ts`'s
`buildTitle` replaced its exhaustive 3-domain if/else (8 hand-written
branches) with a data-driven label list and a general join-with-"and"
helper — verified byte-identical for all 8 original combinations, and now
correct for any subset of the 5 real domains (a real test now covers a
finance+goal combination the old title-builder could never have produced).

## Explicitly still out of scope

No new connector, no new canonical Business Graph entity, no
`agent_sessions`/`agent_plan_steps`/`agent_action_proposals` schema, no
MCP or dynamic tool-calling surface, no freeform LLM-authored planning
(the domain _set_ remains a fixed, code-owned list — this ADR generalizes
its _size_, not its _origin_), and no visible-swarm UI: the Work Mat still
shows one agent identity's own plain-business-language steps, never a
specialist name, a model identity, or a raw reasoning transcript — CLAUDE.md's
"never a visible swarm of AI personalities" stands untouched, independent
of everything else this session negotiated.

## Verification

Both new domains were live-verified end to end against the real dev
database, not just unit-tested: a real lead seeded with no recent contact
produced a real "Lead risk investigation" card through the actual
`investigate risk` command; a real goal (Pipeline value, at least
$50,000, against a real computed value of $15,000 from a seeded lead)
produced a real "Goal risk investigation" card the same way — both with
the standard Approve/Dismiss gate intact. Seeded data and screenshots were
removed afterward.

## Consequences

"Investigate risk" now genuinely covers five real domains instead of
three — a real increase in the mechanism's honest coverage of what
already exists — without adding a single new external dependency, a new
persistence shape, or a new trust boundary. The generalized coordinator
and title-builder are also a real, independent code-quality win: a future
domain (should one become genuinely justified, e.g. once a
`Customer`/`Account` entity or a background job runner exists to support
one of the ideas this session's proposals named) is now a data
registration, not a copy-pasted 40-line block.
