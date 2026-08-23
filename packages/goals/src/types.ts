import type { MetricValue } from "@signaldesk/semantics";

export type GoalComparisonOperator = "at_most" | "at_least";

/**
 * The full status vocabulary Prompt 22 (docs/product-vision-backlog.md)
 * names — declared in full ahead of what's real today, the same
 * "anticipate the real shape honestly" choice `SemanticConcept`
 * (`@signaldesk/semantics`) already makes. `ON_TRACK` is never produced
 * by `evaluateGoal` below: that status specifically claims a goal will be
 * met by some deadline given its current pace, and this app stores
 * neither a goal deadline nor any historical metric snapshot to compute a
 * trend from. What's real instead is a *distance-from-target*
 * classification (`WATCH`/`AT_RISK`/`OFF_TRACK`, banded by fixed,
 * disclosed percentage thresholds — see `evaluate.ts`), which answers "how
 * far off are we right now," not "will we get there in time."
 */
export type GoalStatus =
  "ACHIEVED" | "ON_TRACK" | "WATCH" | "AT_RISK" | "OFF_TRACK" | "NO_DATA";

/** A goal's own definition — mirrors `@signaldesk/persistence`'s
 * `GoalRecord` shape without importing it (this package stays decoupled
 * from the persistence layer, the same boundary `IntelligenceContext`
 * already draws against raw database rows). */
export interface Goal {
  readonly id: string;
  readonly metricId: string;
  readonly name: string;
  readonly comparisonOperator: GoalComparisonOperator;
  readonly targetValue: number;
  readonly currency: string | null;
}

/**
 * The real, computed answer to "actual vs. target, right now" — always
 * produced fresh from a goal definition plus the current
 * `@signaldesk/semantics` `MetricValue`s, never persisted (the same
 * "recomputed fresh each read" choice `MetricValue` itself already makes).
 */
export interface GoalVariance {
  readonly goalId: string;
  readonly metricId: string;
  readonly status: GoalStatus;
  /** `null` when no `MetricValue` for this goal's metric (and, when the
   * goal specifies a currency, matching currency) was found — "no data
   * synced yet," never a fabricated zero (the same distinction Prompt 21's
   * `computeOpenTaskBacklog` honesty fix already established). */
  readonly actualValue: number | null;
  readonly targetValue: number;
  readonly varianceValue: number | null;
  readonly variancePercent: number | null;
  readonly matchedMetric: MetricValue | null;
}
