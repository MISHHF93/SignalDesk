import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type {
  AgentCard,
  AgentTask,
  AgentTaskResult,
} from "@signaldesk/schemas";
import { describe, expect, it, vi } from "vitest";

import { runParallelSpecialists } from "./parallel-specialist-coordinator";

const ALL_AVAILABLE = { isAvailable: () => true };
const NONE_AVAILABLE = { isAvailable: () => false };

function invoiceFinding(): IntelligenceFinding {
  return {
    id: "overdue-invoice:org-1:invoice-1",
    type: "invoice.overdue",
    title: "Acme Robotics invoice overdue",
    summary: "Invoice balance remained unpaid 12 days past its due date.",
    severity: "high",
    confidence: 0.9,
    evidence: [],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "unpaid past due date", confidence: "high" },
    detectedAt: new Date(),
  };
}

function taskFinding(): IntelligenceFinding {
  return {
    id: "overdue-task:org-1:task-1",
    type: "task.overdue",
    title: "Design review overdue",
    summary: "Task remained incomplete 5 days past its due date.",
    severity: "medium",
    confidence: 0.9,
    evidence: [],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "incomplete past due date", confidence: "high" },
    detectedAt: new Date(),
  };
}

function stubResult(
  taskId: string,
  agent: AgentCard,
  findings: readonly IntelligenceFinding[],
): AgentTaskResult {
  return {
    taskId,
    agentId: agent.id,
    status: "completed",
    claims: findings.map((f) => f.summary),
    evidenceIds: findings.map((f) => f.id),
    confidence: 0.8,
  };
}

describe("runParallelSpecialists", () => {
  it("dispatches to both domains on genuinely different agents when both are available", async () => {
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => stubResult(task.id, agent, findings),
    );

    const results = await runParallelSpecialists(
      { findings: [invoiceFinding()] },
      { findings: [taskFinding()] },
      ALL_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(2);
    expect(new Set(results.map((r) => r.agentId)).size).toBe(2);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("contributes nothing for a domain with no findings", async () => {
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => stubResult(task.id, agent, findings),
    );

    const results = await runParallelSpecialists(
      { findings: [] },
      { findings: [taskFinding()] },
      ALL_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("dispatches both domains to the same agent when only one is eligible at all (no ANTHROPIC_API_KEY)", async () => {
    const onlyDeterministic = {
      isAvailable: (card: AgentCard) => card.provider === "deterministic",
    };
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => stubResult(task.id, agent, findings),
    );

    const results = await runParallelSpecialists(
      { findings: [invoiceFinding()] },
      { findings: [taskFinding()] },
      onlyDeterministic,
      dispatch,
    );

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.agentId === "deterministic-specialist")).toBe(
      true,
    );
  });

  it("contributes nothing when no agent is eligible for either domain", async () => {
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => stubResult(task.id, agent, findings),
    );

    const results = await runParallelSpecialists(
      { findings: [invoiceFinding()] },
      { findings: [taskFinding()] },
      NONE_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("converts a dispatch rejection into a failed result instead of throwing", async () => {
    const dispatch = vi.fn(async () => {
      throw new Error("provider exploded");
    });

    const results = await runParallelSpecialists(
      { findings: [invoiceFinding()] },
      { findings: [] },
      ALL_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("failed");
    expect(results[0]?.limitations).toEqual(["provider exploded"]);
  });

  it("passes the real findings through to dispatch, not just their evidence", async () => {
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => stubResult(task.id, agent, findings),
    );
    const finding = invoiceFinding();

    await runParallelSpecialists(
      { findings: [finding] },
      { findings: [] },
      ALL_AVAILABLE,
      dispatch,
    );

    const [, , passedFindings] = dispatch.mock.calls[0]!;
    expect(passedFindings).toEqual([finding]);
  });

  it("one specialist failing does not prevent the other from completing", async () => {
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => {
        if (task.requestedCapability === "interpret_financial_risk") {
          throw new Error("finance specialist down");
        }
        return stubResult(task.id, agent, findings);
      },
    );

    const results = await runParallelSpecialists(
      { findings: [invoiceFinding()] },
      { findings: [taskFinding()] },
      ALL_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(2);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual(["completed", "failed"]);
  });
});
