import { describe, expect, it } from "vitest";

import { evaluatePolicy } from "../src/index";

describe("evaluatePolicy", () => {
  describe("agent_capability", () => {
    it("allows a capability the agent declares", () => {
      const decision = evaluatePolicy({
        kind: "agent_capability",
        agentId: "claude-specialist",
        declaredCapabilities: ["overdue-invoice", "overdue-task"],
        requestedCapability: "overdue-invoice",
      });

      expect(decision.outcome).toBe("allow");
      expect(decision.reason).toContain("claude-specialist");
      expect(decision.reason).toContain("overdue-invoice");
    });

    it("denies a capability the agent never declared", () => {
      const decision = evaluatePolicy({
        kind: "agent_capability",
        agentId: "claude-specialist",
        declaredCapabilities: ["overdue-invoice"],
        requestedCapability: "stuck",
      });

      expect(decision.outcome).toBe("deny");
      expect(decision.reason).toContain("does not declare");
    });

    it("denies when the agent has declared no capabilities at all", () => {
      const decision = evaluatePolicy({
        kind: "agent_capability",
        agentId: "empty-agent",
        declaredCapabilities: [],
        requestedCapability: "stuck",
      });

      expect(decision.outcome).toBe("deny");
    });
  });

  describe("connector_connection_limit", () => {
    it("allows when the plan has no connection limit", () => {
      const decision = evaluatePolicy({
        kind: "connector_connection_limit",
        activeConnectionsUsed: 50,
        activeConnectionsLimit: null,
      });

      expect(decision.outcome).toBe("allow");
    });

    it("allows when usage is below the limit", () => {
      const decision = evaluatePolicy({
        kind: "connector_connection_limit",
        activeConnectionsUsed: 2,
        activeConnectionsLimit: 5,
      });

      expect(decision.outcome).toBe("allow");
    });

    it("denies when usage is at the limit", () => {
      const decision = evaluatePolicy({
        kind: "connector_connection_limit",
        activeConnectionsUsed: 5,
        activeConnectionsLimit: 5,
      });

      expect(decision.outcome).toBe("deny");
      expect(decision.reason).toContain("5");
    });

    it("denies when usage somehow exceeds the limit", () => {
      const decision = evaluatePolicy({
        kind: "connector_connection_limit",
        activeConnectionsUsed: 6,
        activeConnectionsLimit: 5,
      });

      expect(decision.outcome).toBe("deny");
    });
  });
});
