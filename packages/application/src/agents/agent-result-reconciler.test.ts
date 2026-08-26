import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type { AgentTaskResult } from "@signaldesk/schemas";
import { describe, expect, it } from "vitest";

import { reconcileSpecialistResults } from "./agent-result-reconciler";

function invoiceFinding(
  overrides: Partial<IntelligenceFinding> = {},
): IntelligenceFinding {
  return {
    id: "overdue-invoice:org-1:invoice-1",
    type: "invoice.overdue",
    title: "Acme Robotics invoice overdue",
    summary: "Invoice balance remained unpaid 12 days past its due date.",
    severity: "high",
    confidence: 0.9,
    evidence: [
      {
        integrationId: "11111111-1111-4111-8111-111111111111",
        system: "quickbooks",
        externalRecordId: "ext-1",
        sourceVersion: "v1",
        recordDigestSha256: "a".repeat(64),
        lastSyncedAt: new Date(),
      },
    ],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "unpaid past due date", confidence: "high" },
    detectedAt: new Date(),
    ...overrides,
  };
}

function taskFinding(
  overrides: Partial<IntelligenceFinding> = {},
): IntelligenceFinding {
  return {
    id: "overdue-task:org-1:task-1",
    type: "task.overdue",
    title: "Design review overdue",
    summary: "Task remained incomplete 5 days past its due date.",
    severity: "medium",
    confidence: 0.9,
    evidence: [
      {
        integrationId: "22222222-2222-4222-8222-222222222222",
        system: "asana",
        externalRecordId: "ext-2",
        sourceVersion: "v1",
        recordDigestSha256: "b".repeat(64),
        lastSyncedAt: new Date(),
      },
    ],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "incomplete past due date", confidence: "high" },
    detectedAt: new Date(),
    ...overrides,
  };
}

function ticketFinding(
  overrides: Partial<IntelligenceFinding> = {},
): IntelligenceFinding {
  return {
    id: "stuck-ticket:org-1:ticket-1",
    type: "ticket.stuck",
    title: "Support ticket stuck",
    summary: "Ticket remained open 3 days past its response threshold.",
    severity: "medium",
    confidence: 0.9,
    evidence: [
      {
        integrationId: "33333333-3333-4333-8333-333333333333",
        system: "zendesk",
        externalRecordId: "ext-3",
        sourceVersion: "v1",
        recordDigestSha256: "c".repeat(64),
        lastSyncedAt: new Date(),
      },
    ],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "no reply past threshold", confidence: "high" },
    detectedAt: new Date(),
    ...overrides,
  };
}

function result(overrides: Partial<AgentTaskResult> = {}): AgentTaskResult {
  return {
    taskId: "task-1",
    agentId: "claude-specialist",
    status: "completed",
    claims: ["Invoice overdue 12 days."],
    evidenceIds: ["overdue-invoice:org-1:invoice-1"],
    confidence: 0.85,
    ...overrides,
  };
}

describe("reconcileSpecialistResults", () => {
  it("returns finding: null when no result completed", () => {
    const outcome = reconcileSpecialistResults(
      [result({ status: "failed" }), result({ status: "abstained" })],
      [invoiceFinding()],
    );

    expect(outcome.finding).toBeNull();
    expect(outcome.contradictionsDetected).toBe(false);
  });

  it("returns finding: null (honest abstention) when zero results are given", () => {
    expect(
      reconcileSpecialistResults([], [invoiceFinding()]).finding,
    ).toBeNull();
  });

  it("drops a result citing evidence it was never given (malformed result)", () => {
    const outcome = reconcileSpecialistResults(
      [result({ evidenceIds: ["some-finding-not-in-sourceFindings"] })],
      [invoiceFinding()],
    );

    expect(outcome.finding).toBeNull();
  });

  it("returns finding: null when the only completed result cites zero evidence", () => {
    const outcome = reconcileSpecialistResults(
      [result({ evidenceIds: [] })],
      [invoiceFinding()],
    );

    expect(outcome.finding).toBeNull();
  });

  it("builds one reconciled finding from a single trustworthy result", () => {
    const finding = invoiceFinding();
    const outcome = reconcileSpecialistResults([result()], [finding]);

    expect(outcome.finding).not.toBeNull();
    expect(outcome.finding?.type).toBe("agent.investigation");
    expect(outcome.finding?.generatedBy).toBe("agent");
    expect(outcome.finding?.title).toBe("Financial risk investigation");
    expect(outcome.finding?.evidence).toEqual(finding.evidence);
    expect(outcome.finding?.financialContext).toBeUndefined();
    expect(outcome.contradictionsDetected).toBe(false);
  });

  it("titles a cross-domain investigation covering both finance and delivery", () => {
    const outcome = reconcileSpecialistResults(
      [
        result({ evidenceIds: ["overdue-invoice:org-1:invoice-1"] }),
        result({
          agentId: "deterministic-specialist",
          evidenceIds: ["overdue-task:org-1:task-1"],
          claims: ["Task overdue 5 days."],
        }),
      ],
      [invoiceFinding(), taskFinding()],
    );

    expect(outcome.finding?.title).toBe(
      "Finance and delivery risk investigation",
    );
  });

  it("titles a ticket-only investigation", () => {
    const outcome = reconcileSpecialistResults(
      [result({ evidenceIds: ["stuck-ticket:org-1:ticket-1"] })],
      [ticketFinding()],
    );

    expect(outcome.finding?.title).toBe("Ticket risk investigation");
  });

  it("titles a cross-domain investigation covering finance and ticket", () => {
    const outcome = reconcileSpecialistResults(
      [
        result({ evidenceIds: ["overdue-invoice:org-1:invoice-1"] }),
        result({
          agentId: "deterministic-specialist",
          evidenceIds: ["stuck-ticket:org-1:ticket-1"],
        }),
      ],
      [invoiceFinding(), ticketFinding()],
    );

    expect(outcome.finding?.title).toBe(
      "Finance and ticket risk investigation",
    );
  });

  it("titles a cross-domain investigation covering delivery and ticket", () => {
    const outcome = reconcileSpecialistResults(
      [
        result({
          evidenceIds: ["overdue-task:org-1:task-1"],
        }),
        result({
          agentId: "deterministic-specialist",
          evidenceIds: ["stuck-ticket:org-1:ticket-1"],
        }),
      ],
      [taskFinding(), ticketFinding()],
    );

    expect(outcome.finding?.title).toBe(
      "Delivery and ticket risk investigation",
    );
  });

  it("titles a cross-domain investigation covering all three domains", () => {
    const outcome = reconcileSpecialistResults(
      [
        result({ evidenceIds: ["overdue-invoice:org-1:invoice-1"] }),
        result({
          agentId: "deterministic-specialist",
          evidenceIds: ["overdue-task:org-1:task-1"],
        }),
        result({
          agentId: "claude-specialist",
          evidenceIds: ["stuck-ticket:org-1:ticket-1"],
        }),
      ],
      [invoiceFinding(), taskFinding(), ticketFinding()],
    );

    expect(outcome.finding?.title).toBe(
      "Finance, delivery, and ticket risk investigation",
    );
  });

  it("titles a lead-risk-only investigation (ADR 0064's generalized domain list)", () => {
    const leadFinding: IntelligenceFinding = {
      id: "lead-risk:org-1:lead-1",
      type: "lead.follow_up_risk",
      title: "Lead has gone quiet",
      summary: "Lead has had no activity 6 days past the expected window.",
      severity: "medium",
      confidence: 0.85,
      evidence: [],
      freshness: { asOf: new Date(), status: "fresh" },
      explanation: { trigger: "no activity past window", confidence: "high" },
      detectedAt: new Date(),
    };
    const outcome = reconcileSpecialistResults(
      [result({ evidenceIds: ["lead-risk:org-1:lead-1"] })],
      [leadFinding],
    );

    expect(outcome.finding?.title).toBe("Lead risk investigation");
  });

  it("titles a cross-domain investigation covering finance and goal variance — a combination the original 3-domain title-builder could never produce", () => {
    const goalFinding: IntelligenceFinding = {
      id: "goal-variance:org-1:goal-1",
      type: "goal.at_risk",
      title: "Quarterly goal at risk",
      summary: "Metric is trending below its target pace.",
      severity: "low",
      confidence: 0.8,
      evidence: [],
      freshness: { asOf: new Date(), status: "fresh" },
      explanation: { trigger: "below target pace", confidence: "medium" },
      detectedAt: new Date(),
    };
    const outcome = reconcileSpecialistResults(
      [
        result({ evidenceIds: ["overdue-invoice:org-1:invoice-1"] }),
        result({
          agentId: "deterministic-specialist",
          evidenceIds: ["goal-variance:org-1:goal-1"],
        }),
      ],
      [invoiceFinding(), goalFinding],
    );

    expect(outcome.finding?.title).toBe("Finance and goal risk investigation");
  });

  it("dedupes identical claims across results", () => {
    const outcome = reconcileSpecialistResults(
      [result(), result({ agentId: "deterministic-specialist" })],
      [invoiceFinding()],
    );

    expect(outcome.finding?.summary).toBe("Invoice overdue 12 days.");
  });

  it("uses the highest severity among the cited findings, never invented", () => {
    const outcome = reconcileSpecialistResults(
      [
        result({ evidenceIds: ["overdue-invoice:org-1:invoice-1"] }),
        result({
          agentId: "deterministic-specialist",
          evidenceIds: ["overdue-task:org-1:task-1"],
        }),
      ],
      [
        invoiceFinding({ severity: "critical" }),
        taskFinding({ severity: "medium" }),
      ],
    );

    expect(outcome.finding?.severity).toBe("critical");
  });

  it("flags and penalizes a wide confidence spread instead of averaging it away", () => {
    const agreeing = reconcileSpecialistResults(
      [
        result({ confidence: 0.85 }),
        result({ confidence: 0.8, agentId: "deterministic-specialist" }),
      ],
      [invoiceFinding()],
    );
    const disagreeing = reconcileSpecialistResults(
      [
        result({ confidence: 0.95 }),
        result({ confidence: 0.4, agentId: "deterministic-specialist" }),
      ],
      [invoiceFinding()],
    );

    expect(agreeing.contradictionsDetected).toBe(false);
    expect(disagreeing.contradictionsDetected).toBe(true);
    expect(disagreeing.finding!.confidence).toBeLessThan(
      agreeing.finding!.confidence,
    );
  });

  it("reports the WORST (oldest) freshness across every cited finding, not just the first", () => {
    const freshFinding = invoiceFinding({
      freshness: { asOf: new Date("2026-08-20T12:00:00Z"), status: "fresh" },
    });
    const staleFinding = taskFinding({
      freshness: { asOf: new Date("2026-08-18T00:00:00Z"), status: "stale" },
    });

    const outcome = reconcileSpecialistResults(
      [
        result({ evidenceIds: ["overdue-invoice:org-1:invoice-1"] }),
        result({
          agentId: "deterministic-specialist",
          evidenceIds: ["overdue-task:org-1:task-1"],
        }),
      ],
      [freshFinding, staleFinding],
    );

    expect(outcome.finding?.freshness).toEqual(staleFinding.freshness);
  });

  it("only proposes an action when at least one result actually recommended one", () => {
    const withRecommendation = reconcileSpecialistResults(
      [result({ recommendation: "Follow up with the customer." })],
      [invoiceFinding()],
    );
    const withoutRecommendation = reconcileSpecialistResults(
      [result({ recommendation: undefined })],
      [invoiceFinding()],
    );

    expect(withRecommendation.finding?.recommendedActionTypes).toEqual([
      "create_internal_task",
    ]);
    expect(
      withoutRecommendation.finding?.recommendedActionTypes,
    ).toBeUndefined();
  });
});
