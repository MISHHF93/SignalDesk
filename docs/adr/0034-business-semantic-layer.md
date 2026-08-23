# ADR 0034: Business Semantic Layer (first real slice)

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 21 (Universal Business Object &
Semantic Layer — part of the twenty-prompt "Prompts 21-40: platform-
depth expansion" burst) proposed a full `SemanticEntity`/`SemanticField`/
`SemanticMeasure`/`SemanticDimension`/`SemanticRelationship`/
`SemanticMetric`/`MetricFormula`/`MetricDependency`/`MetricUnit`/
`MetricTimeGrain`/`MetricAuthority`/`MetricDefinitionVersion` object model
sitting between raw canonical entities and every higher-level engine
(Signals, AI investigations, Industry Packs, visualizations), so no two
places in the app ever compute "Accounts Receivable" or "Pipeline Value"
differently.

What's real today, for grounding: the Business Graph has exactly four
canonical entities (`leads`, `invoices`, `payments`, `tasks`, each a plain
TypeScript interface in `@signaldesk/domain`); no aggregate business
metric is computed anywhere — every existing `IntelligenceCapability`
either evaluates one record at a time (`overdue-invoice.ts`,
`overdue-task.ts`, `lead-risk.ts`) or reports connector state
(`integration-health.ts`); `IntelligenceContext` only ever carries
_filtered_ subsets fetched for risk detection (`overdueInvoices`,
`overdueTasks`, one representative `lead`), not the full entity sets a
real aggregate (e.g. total AR across every open invoice, not just overdue
ones) needs; `listAllInvoices`/`listAllLeads`/`listAllTasks`
(`@signaldesk/persistence`) already exist, built for the data-export
feature, and are real, working, unfiltered reads this ADR reuses rather
than duplicating.

Building the full twelve-concept object model now — persisted
`MetricDefinitionVersion` history, a live `MetricAuthority` conflict
resolver, generic `SemanticEntity`/`SemanticField` reflection over
entities that don't exist yet — would be exactly the "types nothing
reads" problem this repository's own prior ADRs (Agent Fabric, gaming-HUD
interaction layer) have already flagged and avoided.

## Decision

**A new package, `@signaldesk/semantics`**, sitting below
`@signaldesk/intelligence` in the dependency graph (a peer of `@signaldesk/domain`,
depended on by `apps/web` directly — not by `@signaldesk/intelligence`,
since no existing finding needed reshaping). No new database tables or
migration: every metric is a pure function computed fresh from
already-fetched canonical entities at read time, the same "recomputed
fresh each read, not a persisted, evolving entity" choice
`PrioritizedFinding` already makes.

**The full concept vocabulary (`SemanticConcept`), declared honestly
ahead of its metrics.** All eighteen concepts from Prompt 21's own list
(`Revenue`, `Pipeline`, `Cash`, `AccountsReceivable`, `WorkInProgress`,
`Capacity`, `Utilization`, `Margin`, `CustomerValue`, `OpportunityValue`,
`Commitment`, `Deadline`, `Risk`, `Exposure`, `Backlog`, `ResponseTime`,
`SLA`, `Ownership`) are declared as a closed union now, because later
prompts in this same sequence (Goals/Prompt 22, Commitment
Intelligence/Prompt 25, Financial Exposure/Prompt 26) name these exact
concepts before they have metrics of their own — the same "anticipate the
real shape honestly" choice `ArtifactType`/`Invoice.status` already made.
Only five have a real `MetricDefinition` today (see below);
`getMetricsForConcept` returns `[]`, honestly, for the rest — never a
fabricated value.

**Five real metrics, each backed by data this app already syncs:**

| Metric                        | Concept              | Formula                                        | Authority    |
| ----------------------------- | -------------------- | ---------------------------------------------- | ------------ |
| `accounts_receivable`         | `AccountsReceivable` | sum of `amountCents` across every open invoice | `accounting` |
| `overdue_receivable_exposure` | `Exposure`           | sum across every open, past-due invoice        | `accounting` |
| `pipeline_value`              | `Pipeline`           | sum of `valueCents` across every synced lead   | `crm`        |
| `cash_collected_recent`       | `Cash`               | sum across recently observed payments          | `payments`   |
| `open_task_backlog`           | `Backlog`            | count of synced tasks with `completed = false` | `tasks`      |

Every `MetricValue` carries a `MetricLineage` (formula id/version, source
record count, source systems, and the actual per-record evidence) — the
real, concrete answer to "where did this number come from?" Currency
metrics group by `currency` and produce one `MetricValue` per currency
present rather than ever blending currencies into one silently-wrong
total (`compute.ts`'s `groupByCurrency`).

**A real, tested `detectMetricAuthorityConflicts`,** even though it can
never fire in production today — every capability class this app's
metrics declare has exactly one connector with real sync (QuickBooks for
`accounting`, HubSpot for `crm`, Asana for `tasks`). Tested against a
synthetic two-connector scenario so the check starts working the day a
second connector in the same class ships real sync, rather than needing
to be built retroactively. Its `preferredSourceSystem` parameter is the
declared extension point for a future per-tenant `MetricAuthority`
configuration (Industry Packs/tenant overrides) — no such configuration
store exists yet, so nothing calls it with a real value today.

**One new UI surface, reusing an existing pattern.** `page.tsx` renders a
`BusinessMetricsPanel` between the welcome section and the priority
queue — one tile per `MetricValue`, each with a "Where this comes from"
`<details>` disclosure that reuses `card-shell.tsx`'s existing
`WhyDisclosure` visual pattern (same `.evidenceDetails`/`.evidencePanel`
CSS) rather than inventing a second one. Renders nothing at all when
`metrics: []` — an org (or guest) with no connected sources sees no
panel, not a row of fabricated zeroes.

**A real, caught-during-review honesty fix.** `computeOpenTaskBacklog`
initially always returned exactly one `MetricValue`, even for an empty
task set — verified live (Playwright against the running dev server,
guest sign-in) to render "0 · Open task backlog · 0 records from no
connected source" for a workspace with zero connected data. Fixed to
return `null` when no task has synced at all, and to cite the _entire_
considered task population (not just the incomplete subset) as lineage
when it does return a value — so a real, fully-caught-up backlog (every
synced task complete) still reads as a genuine, well-sourced zero,
distinct from "no data exists."

## Explicitly out of scope

`SemanticEntity`/`SemanticField`/`SemanticDimension` as a generic runtime
reflection system — `entities.ts` is a small, real, human-readable
catalog over the four `@signaldesk/domain` types that already exist, not
a metamodel engine nothing needs yet. `SemanticRelationship` traversal —
that's Prompt 23 (Root Cause & Dependency Intelligence)'s job, not this
one; `Payment.linkedInvoiceExternalIds` already models the one real
cross-entity relationship in today's Business Graph. `MetricDependency`
resolution — every catalog formula sums one entity type directly;
`dependsOnMetricIds` is real and empty on every entry today, populated
the day a metric is defined in terms of another one. Persisted
`MetricDefinitionVersion` history — `formulaVersion` is a plain string on
each definition (mirroring `normalizationVersion`/`ruleVersion` elsewhere
in this schema), not a separate versioned-history table; nothing has
revised a formula yet. Revenue/WorkInProgress/Capacity/Utilization/
Margin/CustomerValue/OpportunityValue/Commitment/Deadline/Risk/
ResponseTime/SLA/Ownership metrics — no connector this app has synced
carries the underlying data (cost rates, SLA policies, contract terms,
capacity plans). A `pipeline_value` closed-won/closed-lost filter — deal
stage is tenant-configurable free text from the source CRM, not a
canonical classification this app can rely on yet (documented directly on
the metric's own `description`, not silently assumed).

## Consequences

Every real aggregate business number on the command center now has one
authoritative definition, one formula, and one lineage — extending this
catalog (a sixth metric, a second currency-normalization rule, a real
per-tenant authority override) means adding to `catalog.ts`/`compute.ts`,
not re-deriving a calculation a second time somewhere else. The concept
vocabulary (`SemanticConcept`) is now available for Prompt 22 (Goal
Intelligence) to reference by id rather than re-inventing what "Margin"
or "Pipeline" means.
