import type { PrioritizedFinding } from "@signaldesk/intelligence";
import { intelligenceCardSchema } from "@signaldesk/schemas";
import { describe, expect, it } from "vitest";

import { composeCards } from "./dashboard-composition";

function finding(
  overrides: Partial<PrioritizedFinding> = {},
): PrioritizedFinding {
  return {
    id: "stuck:org-1:lead-1",
    type: "lead.untouched",
    title: "Priya Nair at Acme Robotics",
    summary: "No recorded interaction for 31 hours.",
    severity: "high",
    confidence: 0.9,
    evidence: [],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: {
      trigger: "No interaction within 24 hours.",
      confidence: "high",
    },
    recommendedActionTypes: ["create_internal_task"],
    detectedAt: new Date(),
    priorityScore: 79,
    priorityReason: ["No interaction within 24 hours."],
    ...overrides,
  };
}

describe("composeCards", () => {
  it("maps a registered finding type to a valid IntelligenceCard", () => {
    const cards = composeCards([finding()]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.type).toBe("stuck");
    expect(cards[0]?.priority).toBe(79);
    expect(intelligenceCardSchema.safeParse(cards[0]).success).toBe(true);
  });

  it("builds a create_internal_task action proposal from recommendedActionTypes", () => {
    const cards = composeCards([finding()]);

    expect(cards[0]?.recommendedActions).toEqual([
      {
        id: "stuck:org-1:lead-1:create_internal_task",
        actionType: "create_internal_task",
        riskClass: "low_risk_internal",
        label: "Create follow-up task",
        requiresApproval: false,
      },
    ]);
  });

  it("maps an invoice.overdue finding to an invoice_risk card", () => {
    const cards = composeCards([
      finding({
        id: "overdue-invoice:org-1:invoice-1",
        type: "invoice.overdue",
        entity: { kind: "invoice", id: "invoice-1" },
        financialContext: {
          label: "Overdue receivable",
          amountCents: 250_000,
          currency: "USD",
        },
      }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.type).toBe("invoice_risk");
    expect(intelligenceCardSchema.safeParse(cards[0]).success).toBe(true);
  });

  it("maps a task.overdue finding to a task_risk card", () => {
    const cards = composeCards([
      finding({
        id: "overdue-task:org-1:task-1",
        type: "task.overdue",
        entity: { kind: "task", id: "task-1" },
      }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.type).toBe("task_risk");
    expect(intelligenceCardSchema.safeParse(cards[0]).success).toBe(true);
  });

  it("omits a finding type with no registered card type (e.g. an ownership gap)", () => {
    const cards = composeCards([finding({ type: "lead.ownership_gap" })]);

    expect(cards).toHaveLength(0);
  });

  it("preserves priority order from the input", () => {
    const higher = finding({ id: "a", priorityScore: 90 });
    const lower = finding({ id: "b", priorityScore: 40 });

    const cards = composeCards([higher, lower]);

    expect(cards.map((card) => card.id)).toEqual(["a", "b"]);
  });
});
