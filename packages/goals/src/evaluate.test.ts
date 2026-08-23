import type { MetricValue } from "@signaldesk/semantics";
import { describe, expect, it } from "vitest";

import { evaluateGoal, isMaterialVariance } from "./evaluate";
import type { Goal } from "./types";

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "goal-1",
    metricId: "accounts_receivable",
    name: "Keep AR under $50,000",
    comparisonOperator: "at_most",
    targetValue: 5_000_000,
    currency: "USD",
    ...overrides,
  };
}

function metricValue(overrides: Partial<MetricValue> = {}): MetricValue {
  return {
    metricId: "accounts_receivable",
    concept: "AccountsReceivable",
    value: 4_000_000,
    unit: "currency",
    currency: "USD",
    valueKind: "DERIVED_VALUE",
    timeGrain: "as_of_now",
    asOf: new Date("2026-08-20T12:00:00.000Z"),
    lineage: {
      formulaId: "sum_open_invoice_amount",
      formulaVersion: "v1",
      sourceRecordCount: 3,
      sourceSystems: ["quickbooks"],
      records: [],
    },
    ...overrides,
  };
}

describe("evaluateGoal", () => {
  it("returns NO_DATA, not a fabricated variance, when the metric never synced", () => {
    const variance = evaluateGoal(goal(), []);

    expect(variance.status).toBe("NO_DATA");
    expect(variance.actualValue).toBeNull();
    expect(variance.matchedMetric).toBeNull();
  });

  it("returns NO_DATA when the metric produced a different currency than the goal declares", () => {
    const variance = evaluateGoal(goal({ currency: "USD" }), [
      metricValue({ currency: "CAD" }),
    ]);

    expect(variance.status).toBe("NO_DATA");
  });

  it("returns NO_DATA when a currency-less goal can't disambiguate two currency groups", () => {
    const variance = evaluateGoal(goal({ currency: null }), [
      metricValue({ currency: "USD" }),
      metricValue({ currency: "CAD" }),
    ]);

    expect(variance.status).toBe("NO_DATA");
  });

  it("marks an at_most goal ACHIEVED when actual is at or below target", () => {
    const variance = evaluateGoal(
      goal({ comparisonOperator: "at_most", targetValue: 5_000_000 }),
      [metricValue({ value: 5_000_000 })],
    );

    expect(variance.status).toBe("ACHIEVED");
    expect(variance.varianceValue).toBe(0);
  });

  it("marks an at_least goal ACHIEVED when actual is at or above target", () => {
    const variance = evaluateGoal(
      goal({ comparisonOperator: "at_least", targetValue: 1_000_000 }),
      [metricValue({ value: 1_200_000 })],
    );

    expect(variance.status).toBe("ACHIEVED");
  });

  it("bands a small overshoot as WATCH, not AT_RISK", () => {
    // 5% over target on an at_most goal.
    const variance = evaluateGoal(
      goal({ comparisonOperator: "at_most", targetValue: 1_000_000 }),
      [metricValue({ value: 1_050_000 })],
    );

    expect(variance.status).toBe("WATCH");
    expect(variance.variancePercent).toBeCloseTo(5, 5);
  });

  it("bands a moderate overshoot as AT_RISK", () => {
    // 30% over target.
    const variance = evaluateGoal(
      goal({ comparisonOperator: "at_most", targetValue: 1_000_000 }),
      [metricValue({ value: 1_300_000 })],
    );

    expect(variance.status).toBe("AT_RISK");
  });

  it("bands a large overshoot as OFF_TRACK", () => {
    // Double the target.
    const variance = evaluateGoal(
      goal({ comparisonOperator: "at_most", targetValue: 1_000_000 }),
      [metricValue({ value: 2_000_000 })],
    );

    expect(variance.status).toBe("OFF_TRACK");
  });

  it("never emits ON_TRACK — no deadline/trend data exists to earn that claim", () => {
    for (const value of [900_000, 1_000_000, 1_050_000, 1_300_000, 5_000_000]) {
      const variance = evaluateGoal(
        goal({ comparisonOperator: "at_most", targetValue: 1_000_000 }),
        [metricValue({ value })],
      );

      expect(variance.status).not.toBe("ON_TRACK");
    }
  });

  it("classifies an at_most-0 goal that isn't met as OFF_TRACK without dividing by zero", () => {
    const variance = evaluateGoal(
      goal({ comparisonOperator: "at_most", targetValue: 0 }),
      [metricValue({ value: 500 })],
    );

    expect(variance.status).toBe("OFF_TRACK");
    expect(Number.isFinite(variance.variancePercent)).toBe(false);
  });

  it("classifies an at_least goal sitting at zero as OFF_TRACK without dividing by zero", () => {
    const variance = evaluateGoal(
      goal({ comparisonOperator: "at_least", targetValue: 1_000_000 }),
      [metricValue({ value: 0 })],
    );

    expect(variance.status).toBe("OFF_TRACK");
  });

  it("matches a currency-less count metric with no ambiguity", () => {
    const variance = evaluateGoal(
      goal({
        metricId: "open_task_backlog",
        currency: null,
        comparisonOperator: "at_most",
        targetValue: 5,
      }),
      [
        metricValue({
          metricId: "open_task_backlog",
          concept: "Backlog",
          unit: "count",
          currency: null,
          value: 3,
        }),
      ],
    );

    expect(variance.status).toBe("ACHIEVED");
    expect(variance.actualValue).toBe(3);
  });
});

describe("isMaterialVariance", () => {
  it("is false for ACHIEVED, WATCH, and NO_DATA", () => {
    for (const status of ["ACHIEVED", "WATCH", "NO_DATA"] as const) {
      expect(
        isMaterialVariance({
          goalId: "g",
          metricId: "accounts_receivable",
          status,
          actualValue: 1,
          targetValue: 1,
          varianceValue: 0,
          variancePercent: 0,
          matchedMetric: null,
        }),
      ).toBe(false);
    }
  });

  it("is true for AT_RISK and OFF_TRACK", () => {
    for (const status of ["AT_RISK", "OFF_TRACK"] as const) {
      expect(
        isMaterialVariance({
          goalId: "g",
          metricId: "accounts_receivable",
          status,
          actualValue: 1,
          targetValue: 1,
          varianceValue: 0,
          variancePercent: 0,
          matchedMetric: null,
        }),
      ).toBe(true);
    }
  });
});
