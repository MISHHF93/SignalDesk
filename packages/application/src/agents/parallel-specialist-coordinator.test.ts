import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type {
  AgentCard,
  AgentTask,
  AgentTaskResult,
} from "@signaldesk/schemas";
import { describe, expect, it, vi } from "vitest";

import {
  runParallelSpecialists,
  type SpecialistDomainRequest,
} from "./parallel-specialist-coordinator";

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

function leadFinding(): IntelligenceFinding {
  return {
    id: "lead-risk:org-1:lead-1",
    type: "lead.follow_up_risk",
    title: "Lead has gone quiet",
    summary:
      "Lead has had no activity 6 days past the expected response window.",
    severity: "medium",
    confidence: 0.85,
    evidence: [],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "no activity past window", confidence: "high" },
    detectedAt: new Date(),
  };
}

function goalFinding(): IntelligenceFinding {
  return {
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

function domainRequest(
  domain: string,
  capability: SpecialistDomainRequest["capability"],
  findings: readonly IntelligenceFinding[],
): SpecialistDomainRequest {
  return {
    domain,
    capability,
    objective: `Interpret ${domain} risk.`,
    findings,
  };
}

const FINANCE = (findings: readonly IntelligenceFinding[]) =>
  domainRequest("finance", "interpret_financial_risk", findings);
const DELIVERY = (findings: readonly IntelligenceFinding[]) =>
  domainRequest("delivery", "interpret_delivery_risk", findings);
const TICKET = (findings: readonly IntelligenceFinding[]) =>
  domainRequest("ticket", "interpret_ticket_risk", findings);
const LEAD = (findings: readonly IntelligenceFinding[]) =>
  domainRequest("lead", "interpret_lead_risk", findings);
const GOAL = (findings: readonly IntelligenceFinding[]) =>
  domainRequest("goal", "interpret_goal_variance", findings);

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
      [
        FINANCE([invoiceFinding()]),
        DELIVERY([taskFinding()]),
        TICKET([ticketFinding()]),
      ],
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

  it("generalizes to more than three real domains (lead and goal, ADR 0064)", async () => {
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => stubResult(task.id, agent, findings),
    );

    const results = await runParallelSpecialists(
      [
        FINANCE([invoiceFinding()]),
        DELIVERY([taskFinding()]),
        TICKET([ticketFinding()]),
        LEAD([leadFinding()]),
        GOAL([goalFinding()]),
      ],
      ALL_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(5);
    expect(dispatch).toHaveBeenCalledTimes(5);
    const capabilities = dispatch.mock.calls.map(
      ([task]) => task.requestedCapability,
    );
    expect(capabilities).toEqual([
      "interpret_financial_risk",
      "interpret_delivery_risk",
      "interpret_ticket_risk",
      "interpret_lead_risk",
      "interpret_goal_variance",
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
      [FINANCE([]), DELIVERY([taskFinding()]), TICKET([])],
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
      [
        FINANCE([invoiceFinding()]),
        DELIVERY([taskFinding()]),
        TICKET([ticketFinding()]),
      ],
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
      [
        FINANCE([invoiceFinding()]),
        DELIVERY([taskFinding()]),
        TICKET([ticketFinding()]),
      ],
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
      [FINANCE([invoiceFinding()]), DELIVERY([]), TICKET([])],
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
      [FINANCE([finding]), DELIVERY([]), TICKET([])],
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
      [
        FINANCE([invoiceFinding()]),
        DELIVERY([taskFinding()]),
        TICKET([ticketFinding()]),
      ],
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
      [
        FINANCE([invoiceFinding()]),
        DELIVERY([taskFinding()]),
        TICKET([ticketFinding()]),
      ],
      ALL_AVAILABLE,
      dispatch,
    );

    expect(results).toHaveLength(3);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual(["completed", "completed", "failed"]);
  });

  it("notifies onSpecialistSettled for each domain the moment its own dispatch settles", async () => {
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => stubResult(task.id, agent, findings),
    );
    const onSpecialistSettled = vi.fn();

    await runParallelSpecialists(
      [
        FINANCE([invoiceFinding()]),
        DELIVERY([taskFinding()]),
        TICKET([ticketFinding()]),
      ],
      ALL_AVAILABLE,
      dispatch,
      onSpecialistSettled,
    );

    expect(onSpecialistSettled).toHaveBeenCalledTimes(3);
    const notifiedDomains = onSpecialistSettled.mock.calls.map(
      (call) => call[0],
    );
    expect(notifiedDomains.sort()).toEqual(["delivery", "finance", "ticket"]);
    for (const call of onSpecialistSettled.mock.calls) {
      expect((call[1] as AgentTaskResult).status).toBe("completed");
    }
  });

  it("notifies onSpecialistSettled with null for a domain that has findings but no eligible agent", async () => {
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => stubResult(task.id, agent, findings),
    );
    const onSpecialistSettled = vi.fn();

    await runParallelSpecialists(
      [
        FINANCE([invoiceFinding()]),
        DELIVERY([taskFinding()]),
        TICKET([ticketFinding()]),
      ],
      NONE_AVAILABLE,
      dispatch,
      onSpecialistSettled,
    );

    expect(onSpecialistSettled).toHaveBeenCalledTimes(3);
    expect(onSpecialistSettled).toHaveBeenCalledWith("finance", null);
    expect(onSpecialistSettled).toHaveBeenCalledWith("delivery", null);
    expect(onSpecialistSettled).toHaveBeenCalledWith("ticket", null);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("notifies onSpecialistSettled with a failed result when dispatch throws", async () => {
    const dispatch = vi.fn(async () => {
      throw new Error("provider exploded");
    });
    const onSpecialistSettled = vi.fn();

    await runParallelSpecialists(
      [FINANCE([invoiceFinding()]), DELIVERY([]), TICKET([])],
      ALL_AVAILABLE,
      dispatch,
      onSpecialistSettled,
    );

    expect(onSpecialistSettled).toHaveBeenCalledTimes(1);
    const [domain, result] = onSpecialistSettled.mock.calls[0]!;
    expect(domain).toBe("finance");
    expect((result as AgentTaskResult).status).toBe("failed");
  });

  it("never calls onSpecialistSettled for a domain with no findings", async () => {
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        findings: readonly IntelligenceFinding[],
      ) => stubResult(task.id, agent, findings),
    );
    const onSpecialistSettled = vi.fn();

    await runParallelSpecialists(
      [FINANCE([]), DELIVERY([taskFinding()]), TICKET([])],
      ALL_AVAILABLE,
      dispatch,
      onSpecialistSettled,
    );

    expect(onSpecialistSettled).toHaveBeenCalledTimes(1);
    expect(onSpecialistSettled).toHaveBeenCalledWith(
      "delivery",
      expect.objectContaining({ status: "completed" }),
    );
  });
});
