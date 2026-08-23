import type { Goal } from "@signaldesk/goals";
import type { MetricValue } from "@signaldesk/semantics";
import { describe, expect, it } from "vitest";

import type { IntelligenceContext } from "../capability";
import { goalVarianceIntelligence } from "./goal-variance";

const NOW = new Date("2026-08-20T14:00:00.000Z");

function baseContext(
  overrides: Partial<IntelligenceContext> = {},
): IntelligenceContext {
  return {
    leads: [],
    overdueInvoices: [],
    overdueTasks: [],
    recentPayments: [],
    now: NOW,
    connectedIntegrationSlugs: [],
    highValueThresholdCents: 1_000_000,
    workingDaysBitmask: 0b1111111,
    timeZone: "UTC",
    goals: [],
    businessMetrics: [],
    recentUnansweredMessages: [],
    stuckSupportTickets: [],
    defaultExpectedResponseHours: 24,
    ...overrides,
  };
}

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "goal_001",
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
    value: 5_000_000,
    unit: "currency",
    currency: "USD",
    valueKind: "DERIVED_VALUE",
    timeGrain: "as_of_now",
    asOf: NOW,
    lineage: {
      formulaId: "sum_open_invoice_amount",
      formulaVersion: "v1",
      sourceRecordCount: 1,
      sourceSystems: ["quickbooks"],
      records: [
        {
          integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
          system: "quickbooks",
          externalRecordId: "qb_1",
          sourceVersion: "1",
          recordDigestSha256: "c".repeat(64),
          lastSyncedAt: new Date("2026-08-20T13:00:00.000Z"),
        },
      ],
    },
    ...overrides,
  };
}

describe("goalVarianceIntelligence", () => {
  it("produces no finding for an ACHIEVED goal", async () => {
    const findings = await goalVarianceIntelligence.evaluate(
      baseContext({
        goals: [goal({ targetValue: 5_000_000 })],
        businessMetrics: [metricValue({ value: 4_000_000 })],
      }),
    );

    expect(findings).toHaveLength(0);
  });

  it("produces no finding for a WATCH-band goal — not yet material", async () => {
    const findings = await goalVarianceIntelligence.evaluate(
      baseContext({
        goals: [goal({ targetValue: 1_000_000 })],
        // 5% over target.
        businessMetrics: [metricValue({ value: 1_050_000 })],
      }),
    );

    expect(findings).toHaveLength(0);
  });

  it("produces no finding when the goal's metric has no data yet", async () => {
    const findings = await goalVarianceIntelligence.evaluate(
      baseContext({
        goals: [goal()],
        businessMetrics: [],
      }),
    );

    expect(findings).toHaveLength(0);
  });

  it("fires a goal.at_risk finding for an AT_RISK goal, with real evidence and financial context", async () => {
    const findings = await goalVarianceIntelligence.evaluate(
      baseContext({
        goals: [goal({ id: "goal_001", targetValue: 1_000_000 })],
        // 30% over target.
        businessMetrics: [metricValue({ value: 1_300_000 })],
      }),
    );

    expect(findings).toHaveLength(1);
    const finding = findings[0]!;
    expect(finding.type).toBe("goal.at_risk");
    expect(finding.entity).toEqual({ kind: "goal", id: "goal_001" });
    expect(finding.severity).toBe("medium");
    // accounts_receivable's own real classification (catalog.ts) is
    // OUTSTANDING_AMOUNT, not AT_RISK_AMOUNT — this test previously
    // asserted the bug (a hardcoded literal in goal-variance.ts) rather
    // than the metric's real exposureType.
    expect(finding.financialContext).toEqual({
      label: "Goal variance",
      exposureType: "OUTSTANDING_AMOUNT",
      amountCents: 300_000,
      currency: "USD",
    });
    expect(finding.evidence).toHaveLength(1);
    expect(finding.evidence[0]?.system).toBe("quickbooks");
  });

  it("derives exposureType from the goal's own metric, not a hardcoded value — a different metric gets a different exposureType", async () => {
    const findings = await goalVarianceIntelligence.evaluate(
      baseContext({
        goals: [
          goal({
            id: "goal_002",
            metricId: "pipeline_value",
            targetValue: 1_000_000,
          }),
        ],
        // 30% over target.
        businessMetrics: [
          metricValue({
            metricId: "pipeline_value",
            concept: "Pipeline",
            value: 1_300_000,
          }),
        ],
      }),
    );

    expect(findings).toHaveLength(1);
    // pipeline_value's own real classification (catalog.ts) is
    // POTENTIAL_EXPOSURE, not the accounts_receivable test's
    // OUTSTANDING_AMOUNT above — proves this comes from the metric
    // definition, not a capability-wide constant.
    expect(findings[0]?.financialContext?.exposureType).toBe(
      "POTENTIAL_EXPOSURE",
    );
  });

  it("classifies a far-OFF_TRACK goal as high severity", async () => {
    const findings = await goalVarianceIntelligence.evaluate(
      baseContext({
        goals: [goal({ targetValue: 1_000_000 })],
        businessMetrics: [metricValue({ value: 3_000_000 })],
      }),
    );

    expect(findings[0]?.severity).toBe("high");
  });

  it("omits financialContext for a count-unit goal", async () => {
    const findings = await goalVarianceIntelligence.evaluate(
      baseContext({
        goals: [
          goal({
            id: "goal_backlog",
            metricId: "open_task_backlog",
            currency: null,
            targetValue: 5,
          }),
        ],
        businessMetrics: [
          metricValue({
            metricId: "open_task_backlog",
            concept: "Backlog",
            unit: "count",
            currency: null,
            value: 20,
          }),
        ],
      }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.financialContext).toBeUndefined();
  });

  it("evaluates every real goal independently", async () => {
    const findings = await goalVarianceIntelligence.evaluate(
      baseContext({
        goals: [
          goal({ id: "goal_a", targetValue: 1_000_000 }),
          goal({ id: "goal_b", targetValue: 1_000_000 }),
        ],
        businessMetrics: [metricValue({ value: 3_000_000 })],
      }),
    );

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.entity?.id).sort()).toEqual([
      "goal_a",
      "goal_b",
    ]);
  });
});
