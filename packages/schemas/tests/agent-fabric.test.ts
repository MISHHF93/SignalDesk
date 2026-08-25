import { describe, expect, it } from "vitest";

import {
  actionProposalSchema,
  agentCapabilityGrantSchema,
  agentCardSchema,
  agentTaskResultSchema,
  agentTaskSchema,
  dashboardIntentSchema,
  draftedContentSchema,
  parseDraftedContent,
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

  it("validates a card declaring the draft_customer_reply capability and message_findings data access", () => {
    const result = agentCardSchema.safeParse({
      ...validAgentCard,
      capabilities: ["draft_customer_reply"],
      dataAccess: ["message_findings"],
    });

    expect(result.success).toBe(true);
  });

  it("still rejects canExecute: true for a card declaring draft_customer_reply — drafting a reply never implies the agent may send it", () => {
    const result = agentCardSchema.safeParse({
      ...validAgentCard,
      capabilities: ["draft_customer_reply"],
      dataAccess: ["message_findings"],
      canExecute: true,
    });

    expect(result.success).toBe(false);
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

  it("validates a send_customer_email_reply proposal, agent-authored with requiresApproval: true", () => {
    const result = actionProposalSchema.safeParse({
      id: "action-1",
      actionType: "send_customer_email_reply",
      riskClass: "agent_assisted_internal",
      label: "Send reply",
      requiresApproval: true,
      proposedByAgentId: "claude-specialist",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a send_customer_email_reply proposal as low_risk_internal — an external send may never skip approval", () => {
    const result = actionProposalSchema.safeParse({
      id: "action-1",
      actionType: "send_customer_email_reply",
      riskClass: "low_risk_internal",
      label: "Send reply",
      requiresApproval: false,
    });

    expect(result.success).toBe(false);
  });
});

describe("draftedContentSchema", () => {
  it("validates a well-formed subject/body draft", () => {
    const result = draftedContentSchema.safeParse({
      subject: "Re: Question about my order",
      body: "Hi, thanks for reaching out — we're looking into this now.",
    });

    expect(result.success).toBe(true);
  });

  it("validates a body-only draft — a comment/note-shaped draft (Asana, HubSpot, Zendesk) has no subject", () => {
    const result = draftedContentSchema.safeParse({
      body: "Hi, thanks for reaching out — we're looking into this now.",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty body — a draft must have real content", () => {
    const result = draftedContentSchema.safeParse({
      subject: "Re: Question about my order",
      body: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects extra fields — a provider must return exactly subject/body, never a free-form envelope", () => {
    const result = draftedContentSchema.safeParse({
      subject: "Re: Question about my order",
      body: "Thanks for reaching out.",
      to: "customer@example.com",
    });

    expect(result.success).toBe(false);
  });

  it("parseDraftedContent throws on malformed provider output rather than silently coercing it", () => {
    expect(() => parseDraftedContent({ subject: "" })).toThrow();
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
