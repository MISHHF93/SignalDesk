import { agentCardSchema } from "@signaldesk/schemas";
import { describe, expect, it } from "vitest";

import { AGENT_REGISTRY, getAgentById } from "./agent-card";

describe("AGENT_REGISTRY", () => {
  it("contains exactly the two real specialists", () => {
    expect(AGENT_REGISTRY.map((card) => card.id)).toEqual([
      "claude-specialist",
      "deterministic-specialist",
    ]);
  });

  it("validates every entry against agentCardSchema", () => {
    for (const card of AGENT_REGISTRY) {
      expect(agentCardSchema.safeParse(card).success).toBe(true);
    }
  });

  it("never lets any agent execute a mutation directly", () => {
    for (const card of AGENT_REGISTRY) {
      expect(card.canExecute).toBe(false);
      expect(card.requiresApproval).toBe(true);
    }
  });

  it("each real specialist declares both capabilities", () => {
    for (const card of AGENT_REGISTRY) {
      expect(card.capabilities).toEqual(
        expect.arrayContaining([
          "interpret_financial_risk",
          "interpret_delivery_risk",
        ]),
      );
    }
  });
});

describe("getAgentById", () => {
  it("finds a registered agent by id", () => {
    expect(getAgentById("deterministic-specialist")?.provider).toBe(
      "deterministic",
    );
  });

  it("returns undefined for an unregistered id", () => {
    expect(getAgentById("made-up-agent")).toBeUndefined();
  });
});
