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

function ticketFinding(): IntelligenceFinding {
  return {
    id: "stuck-ticket:org-1:ticket-1",
    type: "ticket.stuck",
    title: "Support ticket stuck",
    summary: "Ticket remained open 3 days past its response threshold.",
    severity: "medium",
    confidence: 0.9,
    evidence: [],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "no reply past threshold", confidence: "high" },
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
  it("dispatches all three domains, reusing a backend once both real agents are already assigned", async () => {
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
      { findings: [ticketFinding()] },
      ALL_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(3);
    expect(dispatch).toHaveBeenCalledTimes(3);
    // Only two real agents exist, so the third domain can't get a backend
    // distinct from both others — finance and ticket both fall back to the
    // same first-eligible agent (claude-specialist), delivery genuinely
    // differs (deterministic-specialist). This is the documented
    // best-effort consequence, not a bug.
    const agentIds = results.map((r) => r.agentId);
    expect(agentIds).toEqual([
      "claude-specialist",
      "deterministic-specialist",
      "claude-specialist",
    ]);
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
      { findings: [] },
      ALL_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("dispatches every domain to the same agent when only one is eligible at all (no ANTHROPIC_API_KEY)", async () => {
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
      { findings: [ticketFinding()] },
      onlyDeterministic,
      dispatch,
    );

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.agentId === "deterministic-specialist")).toBe(
      true,
    );
  });

  it("contributes nothing when no agent is eligible for any domain", async () => {
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
      { findings: [ticketFinding()] },
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
      { findings: [] },
      ALL_AVAILABLE,
      dispatch,
    );

    const [, , passedFindings] = dispatch.mock.calls[0]!;
    expect(passedFindings).toEqual([finding]);
  });

  it("one specialist failing does not prevent the others from completing", async () => {
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
      { findings: [ticketFinding()] },
      ALL_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(3);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual(["completed", "completed", "failed"]);
  });

  it("ticket specialist failing does not prevent finance/delivery from completing", async () => {
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => {
        if (task.requestedCapability === "interpret_ticket_risk") {
          throw new Error("ticket specialist down");
        }
        return stubResult(task.id, agent, findings);
      },
    );

    const results = await runParallelSpecialists(
      { findings: [invoiceFinding()] },
      { findings: [taskFinding()] },
      { findings: [ticketFinding()] },
      ALL_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(3);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual(["completed", "completed", "failed"]);
  });
});
