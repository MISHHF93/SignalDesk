import { describe, expect, it } from "vitest";

import { AgentRoutingError, selectAgent } from "./agent-router";

const ALL_AVAILABLE = { isAvailable: () => true };
const ONLY_DETERMINISTIC = {
  isAvailable: (card: { provider: string }) =>
    card.provider === "deterministic",
};
const NONE_AVAILABLE = { isAvailable: () => false };

describe("selectAgent", () => {
  it("selects an eligible agent for a known capability", () => {
    const agent = selectAgent("interpret_financial_risk", ALL_AVAILABLE);

    expect(agent.capabilities).toContain("interpret_financial_risk");
  });

  it("selects an eligible agent for the ticket-risk capability", () => {
    const agent = selectAgent("interpret_ticket_risk", ALL_AVAILABLE);

    expect(agent.capabilities).toContain("interpret_ticket_risk");
  });

  it("falls back to the deterministic specialist when the model-backed one is unavailable", () => {
    const agent = selectAgent("interpret_financial_risk", ONLY_DETERMINISTIC);

    expect(agent.id).toBe("deterministic-specialist");
  });

  it("excludes an already-picked agent so a second call routes elsewhere", () => {
    const first = selectAgent("interpret_financial_risk", ALL_AVAILABLE);
    const second = selectAgent("interpret_delivery_risk", ALL_AVAILABLE, {
      exclude: [first.id],
    });

    expect(second.id).not.toBe(first.id);
  });

  it("throws AgentRoutingError when nothing is eligible", () => {
    expect(() =>
      selectAgent("interpret_financial_risk", NONE_AVAILABLE),
    ).toThrow(AgentRoutingError);
  });

  it("throws AgentRoutingError when excluding the only eligible agent", () => {
    expect(() =>
      selectAgent("interpret_financial_risk", ONLY_DETERMINISTIC, {
        exclude: ["deterministic-specialist"],
      }),
    ).toThrow(AgentRoutingError);
  });
});
