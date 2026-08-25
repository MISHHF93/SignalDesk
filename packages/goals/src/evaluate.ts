import type { MetricValue } from "@signaldesk/semantics";

import type { Goal, GoalStatus, GoalVariance } from "./types";

/**
 * Bands how far a not-yet-achieved goal is from its target, as a fixed
 * ratio of target — a distance measure, not a pace/trend forecast (see
 * `GoalStatus`'s own doc comment for why `ON_TRACK` is never produced).
 * `ratio` is always >= 1 by construction (see `computeRatio` below):
 * `1.0` would already be `ACHIEVED` and is never passed in here.
 */
function bandStatus(ratio: number): GoalStatus {
  if (ratio <= 1.1) {
    return "WATCH";
  }

  if (ratio <= 1.5) {
    return "AT_RISK";
  }

  return "OFF_TRACK";
}

/**
 * How far `actualValue` is from `targetValue`, as a ratio >= 1 (1 would
 * mean already achieved, which callers check before reaching here) —
 * always expressed as a fraction of `targetValue`, so the same real-world
 * percentage shortfall/overshoot produces the same ratio (and therefore
 * the same `variancePercent` and `bandStatus`) regardless of which
 * direction the goal points. Real bug found by review: this used to
 * divide by `actualValue` for `at_least` (targetValue / actualValue — a
 * fraction of ACTUAL, not of target), so an `at_least $100,000` goal
 * sitting 50% short ($50,000) reported a 100% variance and a different
 * WATCH/AT_RISK boundary than the mirrored `at_most` case for the
 * identical 50% real-world deviation. `Math.abs` makes this symmetric by
 * construction, so `operator` no longer affects the result — only whether
 * `isAchieved` (a genuinely direction-dependent check) let a non-achieved
 * value reach here at all. Guards the one real divide-by-zero case
 * explicitly (a 0 `targetValue`, meaningful only for an unmet `at_most 0`
 * goal — `at_least` with a 0 target is always already `ACHIEVED` and
 * never reaches here) rather than letting it silently become `NaN`.
 */
function computeRatio(actualValue: number, targetValue: number): number {
  return targetValue > 0
    ? 1 + Math.abs(actualValue - targetValue) / targetValue
    : Number.POSITIVE_INFINITY;
}

function isAchieved(
  operator: Goal["comparisonOperator"],
  actualValue: number,
  targetValue: number,
): boolean {
  return operator === "at_most"
    ? actualValue <= targetValue
    : actualValue >= targetValue;
}

/**
 * Finds the one `MetricValue` this goal is measured against. When
 * `goal.currency` is set, matches on it exactly (a goal about USD
 * receivables must not silently read a CAD total). When unset, matches
 * only if there is exactly one candidate for the metric id — a metric
 * that produced more than one currency group with no goal-declared
 * currency to disambiguate is genuinely ambiguous, so this returns `null`
 * (`NO_DATA`) rather than guessing which one the goal means.
 */
function findMatchedMetric(
  goal: Goal,
  metrics: readonly MetricValue[],
): MetricValue | null {
  const candidates = metrics.filter(
    (metric) => metric.metricId === goal.metricId,
  );

  if (goal.currency !== null) {
    return (
      candidates.find((metric) => metric.currency === goal.currency) ?? null
    );
  }

  return candidates.length === 1 ? candidates[0]! : null;
}

/**
 * The real Goal Intelligence Engine evaluation (Prompt 22,
 * docs/product-vision-backlog.md, ADR 0035) — pure, no I/O, matching
 * `computeBusinessMetrics`'s own "assembly is pure" precedent. Callers
 * supply the goal definitions and the already-computed
 * `@signaldesk/semantics` metric values; this never fetches either.
 */
export function evaluateGoal(
  goal: Goal,
  metrics: readonly MetricValue[],
): GoalVariance {
  const matchedMetric = findMatchedMetric(goal, metrics);

  if (!matchedMetric) {
    return {
      goalId: goal.id,
      metricId: goal.metricId,
      status: "NO_DATA",
      actualValue: null,
      targetValue: goal.targetValue,
      varianceValue: null,
      variancePercent: null,
      matchedMetric: null,
    };
  }

  const actualValue = matchedMetric.value;
  const achieved = isAchieved(
    goal.comparisonOperator,
    actualValue,
    goal.targetValue,
  );
  const ratio = achieved ? 1 : computeRatio(actualValue, goal.targetValue);

  return {
    goalId: goal.id,
    metricId: goal.metricId,
    status: achieved ? "ACHIEVED" : bandStatus(ratio),
    actualValue,
    targetValue: goal.targetValue,
    varianceValue: actualValue - goal.targetValue,
    variancePercent: Number.isFinite(ratio) ? (ratio - 1) * 100 : null,
    matchedMetric,
  };
}

/** `AT_RISK`/`OFF_TRACK` only — "generate Signals only when variance
 * becomes materially actionable rather than notifying on every metric
 * fluctuation" (Prompt 22's own words). `WATCH` stays silent by design:
 * still within 10% of target is not yet worth an attention item. */
export function isMaterialVariance(variance: GoalVariance): boolean {
  return variance.status === "AT_RISK" || variance.status === "OFF_TRACK";
}
