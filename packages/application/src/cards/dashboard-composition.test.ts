import type { PrioritizedFinding } from "@signaldesk/intelligence";
import { intelligenceCardSchema } from "@signaldesk/schemas";
import { describe, expect, it } from "vitest";

import { composeCards } from "./dashboard-composition";

function finding(
  overrides: Partial<PrioritizedFinding> = {},
): PrioritizedFinding {
  return {
    id: "lead-risk:org-1:lead-1",
    type: "lead.follow_up_risk",
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
    expect(cards[0]?.type).toBe("lead_risk");
    expect(cards[0]?.priority).toBe(79);
    expect(intelligenceCardSchema.safeParse(cards[0]).success).toBe(true);
  });

  it("maps a goal.at_risk finding to a goal_variance card", () => {
    const cards = composeCards([
      finding({
        id: "goal-variance:goal-1",
        type: "goal.at_risk",
        entity: { kind: "goal", id: "goal-1" },
      }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.type).toBe("goal_variance");
    expect(intelligenceCardSchema.safeParse(cards[0]).success).toBe(true);
  });

  it("builds a create_internal_task action proposal from recommendedActionTypes", () => {
    const cards = composeCards([finding()]);

    expect(cards[0]?.recommendedActions).toEqual([
      {
        id: "lead-risk:org-1:lead-1:create_internal_task",
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
          exposureType: "OUTSTANDING_AMOUNT",
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

  it("maps a payment.received finding to a payment_received card", () => {
    const cards = composeCards([
      finding({
        id: "payment-received:org-1:payment-1",
        type: "payment.received",
        entity: { kind: "payment", id: "payment-1" },
        severity: "info",
        recommendedActionTypes: [],
        financialContext: {
          label: "Confirmed revenue",
          exposureType: "CONFIRMED_AMOUNT",
          amountCents: 150_000,
          currency: "USD",
        },
      }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.type).toBe("payment_received");
    expect(intelligenceCardSchema.safeParse(cards[0]).success).toBe(true);
  });

  it("maps an agent.investigation finding to an agent_recommendation card requiring approval", () => {
    const cards = composeCards([
      finding({
        id: "agent-investigation:abc",
        type: "agent.investigation",
        generatedBy: "agent",
      }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.type).toBe("agent_recommendation");
    expect(cards[0]?.recommendedActions).toEqual([
      {
        id: "agent-investigation:abc:create_internal_task",
        actionType: "create_internal_task",
        riskClass: "agent_assisted_internal",
        label: "Create follow-up task",
        requiresApproval: true,
      },
    ]);
    expect(intelligenceCardSchema.safeParse(cards[0]).success).toBe(true);
  });

  it("keeps a deterministic capability's proposal at low_risk_internal/requiresApproval:false unaffected by the agent widening", () => {
    const cards = composeCards([finding()]);

    expect(cards[0]?.recommendedActions[0]?.requiresApproval).toBe(false);
    expect(cards[0]?.recommendedActions[0]?.riskClass).toBe(
      "low_risk_internal",
    );
  });

  it("maps a lead.ownership_gap finding to an ownership_gap card (frontend/backend audit, 2026-08-21)", () => {
    const cards = composeCards([
      finding({
        id: "ownership:org-1:lead-1",
        type: "lead.ownership_gap",
        entity: { kind: "lead", id: "lead-1" },
      }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.type).toBe("ownership_gap");
    expect(intelligenceCardSchema.safeParse(cards[0]).success).toBe(true);
  });

  it("omits a finding type with genuinely no registered card type", () => {
    // Every real IntelligenceType has a card mapping today — simulate an
    // unrecognized future type by bypassing the type system, proving
    // composeCards still fails closed (omits, never throws) rather than
    // relying on a real type that could itself gain a mapping later.
    const cards = composeCards([
      finding({ type: "unregistered.future_type" as never }),
    ]);

    expect(cards).toHaveLength(0);
  });

  it("preserves priority order from the input", () => {
    const higher = finding({ id: "a", priorityScore: 90 });
    const lower = finding({ id: "b", priorityScore: 40 });

    const cards = composeCards([higher, lower]);

    expect(cards.map((card) => card.id)).toEqual(["a", "b"]);
  });

  it("attaches relatedFindingIds to cards sharing a real correlationName", () => {
    const invoiceCard = finding({
      id: "overdue-invoice:org-1:invoice-1",
      type: "invoice.overdue",
      entity: { kind: "invoice", id: "invoice-1" },
      correlationName: "acme robotics",
      financialContext: {
        label: "Overdue receivable",
        exposureType: "OUTSTANDING_AMOUNT",
        amountCents: 250_000,
        currency: "USD",
      },
    });
    const leadCard = finding({
      id: "lead-risk:org-1:lead-1",
      correlationName: "acme robotics",
    });

    const cards = composeCards([invoiceCard, leadCard]);
    const invoiceResult = cards.find((card) => card.id === invoiceCard.id);
    const leadResult = cards.find((card) => card.id === leadCard.id);

    expect(invoiceResult?.relatedFindingIds).toEqual([leadCard.id]);
    expect(leadResult?.relatedFindingIds).toEqual([invoiceCard.id]);
    expect(intelligenceCardSchema.safeParse(invoiceResult).success).toBe(true);
  });

  it("does not attach relatedFindingIds when no other card shares the same correlationName", () => {
    const cards = composeCards([
      finding({ id: "a", correlationName: "acme robotics" }),
    ]);

    expect(cards[0]?.relatedFindingIds).toBeUndefined();
  });

  it("does not correlate findings with no correlationName at all", () => {
    const cards = composeCards([finding({ id: "a" }), finding({ id: "b" })]);

    expect(cards[0]?.relatedFindingIds).toBeUndefined();
    expect(cards[1]?.relatedFindingIds).toBeUndefined();
  });
});
