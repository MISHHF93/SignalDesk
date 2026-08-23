# ADR 0035: Goal Intelligence Engine (first real slice)

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 22 (Goals, Targets and Variance
Intelligence) proposed a full `Goal`/`Target`/`KeyResult`/`Milestone`/
`GoalOwner`/`GoalPeriod`/`GoalMetric`/`GoalDependency`/`GoalStatus`/
`GoalVariance`/`GoalForecast` object model connecting business objectives
to live operational evidence, continuously computing actual-vs-target,
pace, variance, remaining requirement, and confidence, classifying
`ON_TRACK`/`WATCH`/`AT_RISK`/`OFF_TRACK`/`ACHIEVED`, and generating a
Signal only when variance becomes materially actionable.

What's real today, for grounding: `@signaldesk/semantics` (Prompt 21, ADR 0034) supplies five real business metrics with full lineage — the first
real substrate a goal could reference. Nothing tracks a business
objective anywhere in this app before this ADR. There is no time-series
or historical-snapshot store of any kind — every metric is computed fresh
from currently-synced data, never a value observed at a past point in
time. That single gap rules out most of the proposal's own vocabulary
honestly: `pace` and `GoalForecast` are pace-of-progress-toward-a-deadline
concepts, and this app has no deadline field to pace against and no trend
to compute pace from. Building the full object model — persisted
`GoalPeriod`/`KeyResult`/`Milestone` hierarchies, a forecast engine, a
five-way status classifier that quietly fabricates the two statuses
(`ON_TRACK`, and a meaningfully distinct `WATCH`) this app cannot
honestly compute — would repeat exactly the premature-object-model risk
this repository's own prior ADRs have flagged and avoided.

## Decision

**A goal is its definition only, evaluated live — never a persisted
status.** The new `goals` table (migration `0041_goals.sql`) stores
`metricId` (checked against the five real `@signaldesk/semantics`
catalog ids), `name`, `comparisonOperator` (`at_most`/`at_least`),
`targetValue`, and an optional `currency` — nothing else. Forced RLS,
append-only (select + insert only, the same `card_feedback.sql` template
every recent tenant table follows) — removing a stale goal is an
explicitly disclosed gap in this first slice, not an oversight.

**A new `@signaldesk/goals` package** computes `GoalVariance` purely from
a `Goal` plus the current `@signaldesk/semantics` `MetricValue[]` — no
I/O, matching `computeBusinessMetrics`'s own "assembly is pure"
precedent. `evaluateGoal` matches a goal to its metric by id (and
currency, when declared — an ambiguous multi-currency match without a
declared currency returns `NO_DATA` rather than guessing).

**A real, distance-based status classification, honestly not the
proposal's own pace-based one.** `GoalStatus` declares the full
`ACHIEVED`/`ON_TRACK`/`WATCH`/`AT_RISK`/`OFF_TRACK`/`NO_DATA` vocabulary
Prompt 22 names, but `evaluateGoal` never produces `ON_TRACK` — that
status specifically claims "will be met by some deadline given current
pace," and this app stores neither a deadline nor a historical trend to
support that claim. What it computes instead: `ACHIEVED` when the
comparison is already satisfied, otherwise a fixed, disclosed
percentage-of-target band (`WATCH` within 10%, `AT_RISK` within 50%,
`OFF_TRACK` beyond that) — a real "how far off are we right now" measure,
never dressed up as a forecast. Divide-by-zero is guarded explicitly for
an `at_most 0` goal not yet met and an `at_least N` goal sitting at
exactly 0, both classified `OFF_TRACK` rather than producing `NaN`.

**One real Signal-equivalent, reusing the existing finding pipeline
rather than inventing a second one.** A new `goalVarianceIntelligence`
capability (`@signaldesk/intelligence`) evaluates every real goal each
render and produces a finding only for `AT_RISK`/`OFF_TRACK` — "generate
Signals only when variance becomes materially actionable rather than
notifying on every metric fluctuation," Prompt 22's own words; `ACHIEVED`/
`WATCH`/`NO_DATA` stay silent. `IntelligenceContext` gained two fields
(`goals`, `businessMetrics`) so this capability — and any future one — can
read both without a parallel context object. The finding flows through
the exact same `composeCards`/Card Registry pipeline every other finding
already uses (`cardTypeSchema` widened to `goal_variance`, a real DB
migration widening `card_feedback`'s own check constraint to match, so
Adaptive Attention feedback works on a goal card exactly like any other).

**Lineage evidence carries real `SourceReference`s, not a narrower
shape.** Building this capability surfaced a real gap in the Semantic
Layer from ADR 0034: `MetricLineageRecord` only carried
`system`/`externalRecordId`/`sourceVersion`, missing the
`integrationId`/`recordDigestSha256`/`lastSyncedAt` a finding's
`evidence: readonly SourceReference[]` requires. Fixed by making
`MetricLineageRecord` a type alias for the real `SourceReference`
(`@signaldesk/domain`) rather than a parallel shape — every metric's
lineage now doubles as real, citable finding evidence for free.

**A real write, a real UI, live-verified.** `createGoalAction` mirrors
`createInternalTaskAction` exactly (idempotent insert, real audit event,
`organizationId` derived only from the authenticated session). A new
`GoalsPanel` on the command center lists every goal with its live-computed
status and a `CreateGoalForm` to add one — rendered inline, not a new
page, per Prompt 22's own "surface Goal cards inside Business Pulse
without creating another dashboard." Verified live with Playwright against
the running dev server (guest sign-in, real form submission, real
persisted row, real `card_feedback`-style audit event) — which surfaced a
real gap before it shipped: the newly created goal didn't appear in the
list without a manual reload, since the server-rendered list was fetched
before the submission. Fixed with a `router.refresh()` on success.

## Explicitly out of scope

`GoalPeriod`/time-bucketed goals, `KeyResult`/`Milestone` hierarchies,
`GoalDependency`, `GoalForecast`, and pace/`ON_TRACK` — all need either a
deadline field or historical trend data this app has neither of.
Deterministic decomposition of which entities contribute most to
variance — today's five metrics are simple sums with per-record lineage
already available (Prompt 21), but ranking contributors is real work not
yet built. Goal editing or deletion — creation and live-computed status
only. Industry Pack goal templates — blocked on the same "one real
vertical" gap this file's own Industry Pack entries already name.

## Consequences

A business objective now has one real, honest place to live, one real
evaluation, and one real path into the same attention surface every other
finding already uses — extending this (a sixth goal-eligible metric, a
real deadline field once historical data exists) means widening this
catalog, not building a second Goal-shaped system beside it. The
`SemanticConcept` vocabulary from ADR 0034 is now proven load-bearing
beyond its own five metrics: a goal referenced one by id before this ADR
added anything new to that vocabulary.
