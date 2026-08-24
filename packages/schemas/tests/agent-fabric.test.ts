import { describe, expect, it } from "vitest";

import {
  actionProposalSchema,
  agentCapabilityGrantSchema,
  agentCardSchema,
  agentTaskResultSchema,
  agentTaskSchema,
  dashboardIntentSchema,
} from "../src/index";

const sourceReference = {
  integrationId: "44444444-4444-4444-8444-444444444444",
  system: "quickbooks",
  externalRecordId: "external-invoice-001",
  sourceVersion: "version-3",
  recordDigestSha256:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  lastSyncedAt: new Date("2026-08-19T11:55:00.000Z"),
};

const validAgentCard = {
  id: "claude-specialist",
  provider: "anthropic",
  displayName: "Claude specialist",
  description: "Interprets real findings using a Claude-backed model.",
  capabilities: ["interpret_financial_risk"],
  dataAccess: ["invoice_findings"],
  riskLevel: "moderate",
  canRead: true,
  canPropose: true,
  canExecute: false,
  requiresApproval: true,
  costPerTaskUsdMicros: 500,
  timeBudgetMs: 30_000,
};

describe("agentCardSchema", () => {
  it("validates a complete agent card", () => {
    expect(agentCardSchema.safeParse(validAgentCard).success).toBe(true);
  });

  it("rejects canExecute: true — no agent may execute a mutation directly", () => {
    const result = agentCardSchema.safeParse({
      ...validAgentCard,
      canExecute: true,
    });

    expect(result.success).toBe(false);
  });

  it("rejects requiresApproval: false", () => {
    const result = agentCardSchema.safeParse({
      ...validAgentCard,
      requiresApproval: false,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unregistered capability", () => {
    const result = agentCardSchema.safeParse({
      ...validAgentCard,
      capabilities: ["execute_arbitrary_sql"],
    });

    expect(result.success).toBe(false);
  });

  it("validates a card declaring the ticket-risk capability and data access", () => {
    const result = agentCardSchema.safeParse({
      ...validAgentCard,
      capabilities: ["interpret_ticket_risk"],
      dataAccess: ["ticket_findings"],
    });

    expect(result.success).toBe(true);
  });
});

describe("agentTaskSchema", () => {
  it("validates a complete task", () => {
    const result = agentTaskSchema.safeParse({
      id: "task-1",
      objective: "Interpret overdue invoice findings.",
      requestedCapability: "interpret_financial_risk",
      contextRefs: [sourceReference],
      constraints: { maxFindings: 10, mustNotInventFacts: true },
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty contextRefs array — a task must be grounded in real evidence", () => {
    const result = agentTaskSchema.safeParse({
      id: "task-1",
      objective: "Interpret overdue invoice findings.",
      requestedCapability: "interpret_financial_risk",
      contextRefs: [],
      constraints: { maxFindings: 10, mustNotInventFacts: true },
    });

    expect(result.success).toBe(false);
  });

  it("rejects mustNotInventFacts: false", () => {
    const result = agentTaskSchema.safeParse({
      id: "task-1",
      objective: "Interpret overdue invoice findings.",
      requestedCapability: "interpret_financial_risk",
      contextRefs: [sourceReference],
      constraints: { maxFindings: 10, mustNotInventFacts: false },
    });

    expect(result.success).toBe(false);
  });
});

describe("agentTaskResultSchema", () => {
  it("validates a completed result", () => {
    const result = agentTaskResultSchema.safeParse({
      taskId: "task-1",
      agentId: "claude-specialist",
      status: "completed",
      claims: ["3 invoices totaling $4,200 are overdue."],
      evidenceIds: ["overdue-invoice:org-1:invoice-1"],
      recommendation: "Follow up with the customer.",
      confidence: 0.8,
    });

    expect(result.success).toBe(true);
  });

  it("rejects confidence outside [0, 1]", () => {
    const result = agentTaskResultSchema.safeParse({
      taskId: "task-1",
      agentId: "claude-specialist",
      status: "completed",
      claims: [],
      evidenceIds: [],
      confidence: 1.5,
    });

    expect(result.success).toBe(false);
  });
});

describe("agentCapabilityGrantSchema", () => {
  it("validates a complete grant", () => {
    const result = agentCapabilityGrantSchema.safeParse({
      id: "grant-1",
      collaborationId: "collab-1",
      agentId: "claude-specialist",
      capability: "interpret_financial_risk",
      canRead: true,
      canPropose: true,
      canExecute: false,
      expiresAt: new Date("2026-08-19T12:05:00.000Z"),
    });

    expect(result.success).toBe(true);
  });

  it("rejects canExecute: true", () => {
    const result = agentCapabilityGrantSchema.safeParse({
      id: "grant-1",
      collaborationId: "collab-1",
      agentId: "claude-specialist",
      capability: "interpret_financial_risk",
      canRead: true,
      canPropose: true,
      canExecute: true,
      expiresAt: new Date("2026-08-19T12:05:00.000Z"),
    });

    expect(result.success).toBe(false);
  });
});

describe("actionProposalSchema — agent-assisted widening", () => {
  it("still rejects requiresApproval: true for a low_risk_internal proposal", () => {
    const result = actionProposalSchema.safeParse({
      id: "action-1",
      actionType: "create_internal_task",
      riskClass: "low_risk_internal",
      label: "Create task",
      requiresApproval: true,
    });

    expect(result.success).toBe(false);
  });

  it("validates an agent_assisted_internal proposal with requiresApproval: true", () => {
    const result = actionProposalSchema.safeParse({
      id: "action-1",
      actionType: "create_internal_task",
      riskClass: "agent_assisted_internal",
      label: "Create task",
      requiresApproval: true,
      proposedByAgentId: "claude-specialist",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an agent_assisted_internal proposal with requiresApproval: false", () => {
    const result = actionProposalSchema.safeParse({
      id: "action-1",
      actionType: "create_internal_task",
      riskClass: "agent_assisted_internal",
      label: "Create task",
      requiresApproval: false,
    });

    expect(result.success).toBe(false);
  });
});

describe("dashboardIntentSchema — agent_investigate", () => {
  it("validates an agent_investigate intent", () => {
    const result = dashboardIntentSchema.safeParse({
      type: "agent_investigate",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an agent_investigate intent carrying extra fields", () => {
    const result = dashboardIntentSchema.safeParse({
      type: "agent_investigate",
      entityId: "should-not-be-here",
    });

    expect(result.success).toBe(false);
  });
});
