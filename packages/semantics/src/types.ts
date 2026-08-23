import type { ExposureType, SourceReference } from "@signaldesk/domain";
import type { ConnectorCapabilityClass } from "@signaldesk/integrations";

import type { SemanticConcept } from "./concepts";
import type { MetricTimeGrain, MetricUnit, MetricValueKind } from "./units";

/**
 * Lineage evidence is the *same* `SourceReference` shape every
 * `IntelligenceFinding`'s own `evidence` already carries (not a narrower
 * parallel shape) — so a capability built on top of a `MetricValue` (e.g.
 * `@signaldesk/intelligence`'s `goalVarianceIntelligence`, Prompt 22) can
 * cite this lineage directly as real finding evidence, rather than having
 * real source records it can't actually point to.
 */
export type MetricLineageRecord = SourceReference;

/** The full "where did this number come from?" answer for one `MetricValue`. */
export interface MetricLineage {
  readonly formulaId: string;
  readonly formulaVersion: string;
  readonly sourceRecordCount: number;
  readonly sourceSystems: readonly string[];
  readonly records: readonly MetricLineageRecord[];
}

/**
 * A computed number, always paired with its lineage — no `MetricValue` is
 * ever produced without one, so "what does this number mean" and "where
 * did it come from" travel together.
 */
export interface MetricValue {
  readonly metricId: string;
  readonly concept: SemanticConcept;
  /** Integer cents when `unit` is `"currency"` (matching every other
   * monetary field in this codebase — `Invoice.amountCents`,
   * `Lead.valueCents`, ...), a plain count when `unit` is `"count"`. */
  readonly value: number;
  readonly unit: MetricUnit;
  /** Present only when `unit` is `"currency"` — the ISO currency every
   * contributing record shares. A metric never silently blends currencies
   * (see `compute.ts`'s per-currency grouping): a data set spanning more
   * than one currency produces one `MetricValue` per currency instead of
   * one summed total. */
  readonly currency: string | null;
  readonly valueKind: MetricValueKind;
  readonly timeGrain: MetricTimeGrain;
  readonly asOf: Date;
  readonly lineage: MetricLineage;
}

/**
 * The catalog entry — the human-readable definition every displayed number
 * can point back to, and the declared authority a real second connector in
 * the same capability class would conflict with (see `authority.ts`).
 *
 * `dependsOnMetricIds` is the real `MetricDependency` list, empty for
 * every catalog entry today: nothing in this package is composed from
 * another metric yet (each formula sums one canonical entity type
 * directly) — populate it the day a metric is defined in terms of another
 * one, not before.
 */
export interface MetricDefinition {
  readonly id: string;
  readonly concept: SemanticConcept;
  readonly name: string;
  readonly description: string;
  readonly unit: MetricUnit;
  readonly timeGrain: MetricTimeGrain;
  readonly valueKind: MetricValueKind;
  readonly formulaId: string;
  readonly formulaVersion: string;
  readonly formulaDescription: string;
  /** Which connector capability class is authoritative for this concept
   * today — `null` for a metric with no connector-backed source of truth.
   * None are `null` yet, but the field stays honestly nullable rather than
   * assuming every future metric has one. */
  readonly authorityCapabilityClass: ConnectorCapabilityClass | null;
  readonly dependsOnMetricIds: readonly string[];
  /** What kind of financial exposure this metric represents (Prompt 26,
   * ADR 0037) — `null` for a metric with no dollar-amount exposure
   * meaning at all (`open_task_backlog` is a count, not money). */
  readonly exposureType: ExposureType | null;
}
