import { evaluateGoal, isMaterialVariance } from "@signaldesk/goals";
import { getMetricDefinition } from "@signaldesk/semantics";

import type {
  IntelligenceCapability,
  IntelligenceContext,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { freshnessStatus } from "../format";

/**
 * `Goal.targetValue`/`GoalVariance.actualValue` are stored/computed in
 * cents for a currency-unit metric (the same convention `amountCents`
 * uses everywhere else in this codebase) — never divided by 100 before
 * this fix, so a card previously showed a raw figure like "200000 USD"
 * instead of "$2,000.00". Count-unit metrics (e.g. open_task_backlog)
 * have no such scaling and are rendered as a plain number.
 */
function formatMetricValue(
  value: number,
  unit: "currency" | "count",
  currency: string | null,
): string {
  if (unit === "count") {
    return String(value);
  }

  const formatted = (value / 100).toFixed(2);
  return currency ? `${formatted} ${currency}` : formatted;
}

/**
 * The Goal Intelligence Engine's one real Signal-equivalent (Prompt 22,
 * docs/product-vision-backlog.md, ADR 0035): evaluates every real goal
 * against the current `@signaldesk/semantics` metric values and produces a
 * finding only for `AT_RISK`/`OFF_TRACK` goals (`isMaterialVariance`) —
 * "generate Signals only when variance becomes materially actionable
 * rather than notifying on every metric fluctuation," Prompt 22's own
 * words. A goal that's `ACHIEVED`, `WATCH` (within 10% of target), or has
 * `NO_DATA` yet produces nothing here — silent, matching every other
 * capability's "no finding" convention for a healthy or unmeasurable
 * state.
 */
export const goalVarianceIntelligence: IntelligenceCapability = {
  id: "goal-variance",
  description:
    "Detects goals whose current metric value is materially off target.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const { goals, businessMetrics, now } = context;
    const findings: IntelligenceFinding[] = [];

    for (const goal of goals) {
      const variance = evaluateGoal(goal, businessMetrics);

      if (!isMaterialVariance(variance) || !variance.matchedMetric) {
        // The second check is unreachable in practice — isMaterialVariance
        // is only ever true for AT_RISK/OFF_TRACK, and evaluateGoal only
        // ever produces those statuses when a metric was actually matched
        // (NO_DATA is the only unmatched outcome, and it is never
        // material) — kept explicit rather than a `!` assertion so this
        // stays safe if that relationship ever changes.
        continue;
      }

      const matchedMetric = variance.matchedMetric;
      const definition = getMetricDefinition(goal.metricId);
      const metricName = definition?.name ?? goal.metricId;

      const oldestSync = matchedMetric.lineage.records.reduce<Date | null>(
        (oldest, record) =>
          !oldest || record.lastSyncedAt < oldest
            ? record.lastSyncedAt
            : oldest,
        null,
      );
      const sourceFreshnessMinutes = oldestSync
        ? Math.max(
            0,
            Math.floor((now.getTime() - oldestSync.getTime()) / 60_000),
          )
        : 0;

      const variancePercentLabel = variance.variancePercent
        ? `${variance.variancePercent > 0 ? "+" : ""}${variance.variancePercent.toFixed(0)}%`
        : "unmeasurable";

      findings.push({
        id: `goal-variance:${goal.id}`,
        type: "goal.at_risk",
        entity: { kind: "goal", id: goal.id },
        title: `"${goal.name}" is ${variance.status === "OFF_TRACK" ? "off track" : "at risk"}`,
        summary: `${metricName} is currently ${variancePercentLabel} away from its target, ${goal.comparisonOperator === "at_most" ? "at most" : "at least"} ${formatMetricValue(goal.targetValue, matchedMetric.unit, matchedMetric.currency ?? null)}.`,
        severity: variance.status === "OFF_TRACK" ? "high" : "medium",
        confidence: CONFIDENCE_DETERMINISTIC_RULE,
        // exposureType comes from the metric's own real classification
        // (definition.exposureType — e.g. accounts_receivable is
        // OUTSTANDING_AMOUNT, pipeline_value is POTENTIAL_EXPOSURE), not a
        // hardcoded literal: a goal tracking pipeline value going off
        // track is a different kind of financial claim than one tracking
        // overdue receivables, and mislabeling either as "AT_RISK_AMOUNT"
        // is exactly the mislabeling `exposureType` was added to prevent
        // (found by a deep audit, 2026-08-22 — the capability's own test
        // had encoded the wrong value rather than catching it). Omits
        // financialContext entirely, rather than fabricating a value,
        // for the one currency metric with no real exposure
        // classification (none exist today, but `exposureType` is
        // nullable on `MetricDefinition` for exactly this case).
        ...(matchedMetric.unit === "currency" &&
        matchedMetric.currency &&
        definition?.exposureType
          ? {
              financialContext: {
                label: "Goal variance" as const,
                exposureType: definition.exposureType,
                amountCents: Math.abs(variance.varianceValue ?? 0),
                currency: matchedMetric.currency,
              },
            }
          : {}),
        evidence: matchedMetric.lineage.records.map((reference) => ({
          ...reference,
        })),
        freshness: {
          asOf: oldestSync ?? now,
          status: oldestSync
            ? freshnessStatus(sourceFreshnessMinutes)
            : "unknown",
        },
        explanation: {
          trigger: `Current value moved far enough from this goal's target to count as ${variance.status === "OFF_TRACK" ? "off track" : "at risk"}.`,
          observedValue: `${metricName}: ${formatMetricValue(variance.actualValue ?? 0, matchedMetric.unit, matchedMetric.currency ?? null)}`,
          expectedBaseline: `${goal.comparisonOperator === "at_most" ? "At most" : "At least"} ${formatMetricValue(goal.targetValue, matchedMetric.unit, matchedMetric.currency ?? null)}`,
          confidence: "high",
        },
        detectedAt: now,
      });
    }

    return findings;
  },
};
