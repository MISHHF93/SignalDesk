import { evaluateGoal, type GoalStatus } from "@signaldesk/goals";
import type { GoalRecord } from "@signaldesk/persistence";
import { getMetricDefinition, type MetricValue } from "@signaldesk/semantics";

import type { CreateGoalAction } from "../_lib/actions";
import { formatCardCurrency } from "../_cards/format";
import { CreateGoalForm } from "./create-goal-form";

const STATUS_LABEL: Record<GoalStatus, string> = {
  ACHIEVED: "Achieved",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  NO_DATA: "No data yet",
};

function formatActual(metric: MetricValue): string {
  return metric.unit === "currency"
    ? formatCardCurrency(metric.value, metric.currency ?? "USD")
    : new Intl.NumberFormat("en-CA").format(metric.value);
}

function formatTarget(
  goal: GoalRecord,
  unit: "currency" | "count" | undefined,
): string {
  return unit === "currency"
    ? formatCardCurrency(goal.targetValue, goal.currency ?? "USD")
    : new Intl.NumberFormat("en-CA").format(goal.targetValue);
}

/**
 * The Goal Intelligence Engine's real UI (Prompt 22,
 * docs/product-vision-backlog.md, ADR 0035) — every goal's status is
 * computed live via `evaluateGoal` from the same `metrics` the command
 * center already fetched, never re-queried. A goal that's currently
 * `AT_RISK`/`OFF_TRACK` also produces a real card in the priority queue
 * above (`goalVarianceIntelligence`) — this panel is where every goal
 * lives, healthy or not, and where a new one gets added, not a second
 * notification stream for the same thing.
 */
export function GoalsPanel({
  goals,
  metrics,
  createGoalAction,
}: {
  readonly goals: readonly GoalRecord[];
  readonly metrics: readonly MetricValue[];
  readonly createGoalAction: CreateGoalAction;
}) {
  return (
    <section className="goalsSection" aria-labelledby="goals-heading">
      <p className="sectionKicker" id="goals-heading">
        Goals
      </p>
      {goals.length > 0 ? (
        <ul className="goalsList">
          {goals.map((goal) => {
            const variance = evaluateGoal(goal, metrics);
            const definition = getMetricDefinition(goal.metricId);

            return (
              <li className="goalRow" key={goal.id}>
                <span
                  className="goalStatusBadge"
                  data-goal-status={variance.status}
                >
                  {STATUS_LABEL[variance.status]}
                </span>
                <span className="goalName">{goal.name}</span>
                <span className="goalProgress">
                  {variance.matchedMetric
                    ? formatActual(variance.matchedMetric)
                    : "—"}{" "}
                  / {goal.comparisonOperator === "at_most" ? "≤" : "≥"}{" "}
                  {formatTarget(goal, definition?.unit)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="goalsEmpty">
          No goals yet — add one below to track a Business Metric against a real
          target.
        </p>
      )}
      <CreateGoalForm createGoalAction={createGoalAction} metrics={metrics} />
    </section>
  );
}
