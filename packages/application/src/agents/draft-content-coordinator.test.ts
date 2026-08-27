import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type {
  AgentCard,
  AgentTask,
  AgentTaskResult,
} from "@signaldesk/schemas";
import { describe, expect, it, vi } from "vitest";

import {
  draftContent,
  type DraftContentDispatch,
} from "./draft-content-coordinator";

const ALL_AVAILABLE = { isAvailable: () => true };
const NONE_AVAILABLE = { isAvailable: () => false };

interface InvoiceReminderDraftContext {
  readonly customerName: string;
  readonly amountCents: number;
  readonly currency: string;
}

function invoiceFinding(): IntelligenceFinding {
  return {
    id: "invoice:org-1:invoice-1",
    type: "invoice.overdue",
    entity: { kind: "invoice", id: "invoice-1" },
    title: "Invoice for Acme Robotics is overdue",
    summary: "14 days past due.",
    severity: "medium",
    confidence: 0.9,
    evidence: [],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "due date passed", confidence: "high" },
    detectedAt: new Date(),
  };
}

const CONTEXT: InvoiceReminderDraftContext = {
  customerName: "Acme Robotics",
  amountCents: 184_000,
  currency: "USD",
};

function stubDraftResult(taskId: string, agent: AgentCard): AgentTaskResult {
  return {
    taskId,
    agentId: agent.id,
    status: "completed",
    claims: [],
    evidenceIds: [],
    confidence: 0.8,
    draftedContent: {
      subject: "Reminder: invoice payment due",
      body: "Your invoice for $1,840.00 is now 14 days past due.",
    },
  };
}

/**
 * Real behavioral coverage for a function that had none: draftContent
 * generalizes draftMessageReply's exact orchestration shape (ADR 0057) for
 * QuickBooks/Asana/HubSpot/Zendesk's draft-then-approve actions, but never
 * gained the matching test coverage message-reply-draft-coordinator.test.ts
 * already has — this mirrors that file's structure exactly, substituting an
 * invoice-reminder capability/context for the message-reply one.
 */
describe("draftContent", () => {
  it("dispatches to an eligible agent and returns its drafted content", async () => {
    const dispatch: DraftContentDispatch<InvoiceReminderDraftContext> = vi.fn(
      async (task: AgentTask, agent: AgentCard) =>
        stubDraftResult(task.id, agent),
    );

    const result = await draftContent(
      "draft_invoice_reminder",
      "Draft a professional payment reminder for this overdue invoice, grounded only in its real amount and due date.",
      invoiceFinding(),
      CONTEXT,
      ALL_AVAILABLE,
      dispatch,
    );

    expect(result.status).toBe("completed");
    expect(result.draftedContent?.subject).toBe(
      "Reminder: invoice payment due",
    );
    expect(dispatch).toHaveBeenCalledTimes(1);

    const [task, , findings, context] = vi.mocked(dispatch).mock.calls[0]!;

    expect(task.requestedCapability).toBe("draft_invoice_reminder");
    expect(task.constraints.maxFindings).toBe(1);
    expect(findings).toHaveLength(1);
    expect(context).toBe(CONTEXT);
  });

  it("returns a failed result, never throws, when no agent is eligible", async () => {
    const dispatch = vi.fn();

    const result = await draftContent(
      "draft_invoice_reminder",
      "Draft a reminder.",
      invoiceFinding(),
      CONTEXT,
      NONE_AVAILABLE,
      dispatch,
    );

    expect(result.status).toBe("failed");
    expect(result.draftedContent).toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("returns a failed result, never throws, when dispatch itself rejects", async () => {
    const dispatch = vi.fn(async () => {
      throw new Error("Claude rate limited");
    });

    const result = await draftContent(
      "draft_invoice_reminder",
      "Draft a reminder.",
      invoiceFinding(),
      CONTEXT,
      ALL_AVAILABLE,
      dispatch,
    );

    expect(result.status).toBe("failed");
    expect(result.limitations).toEqual(["Claude rate limited"]);
  });

  it("always dispatches to the always-available deterministic-specialist when only it is eligible", async () => {
    const deterministicOnly = {
      isAvailable: (card: AgentCard) => card.provider === "deterministic",
    };
    const dispatch = vi.fn(async (task: AgentTask, agent: AgentCard) =>
      stubDraftResult(task.id, agent),
    );

    const result = await draftContent(
      "draft_invoice_reminder",
      "Draft a reminder.",
      invoiceFinding(),
      CONTEXT,
      deterministicOnly,
      dispatch,
    );

    expect(result.status).toBe("completed");
    expect(dispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "deterministic-specialist" }),
      expect.anything(),
      CONTEXT,
    );
  });

  it("works generically for a different capability/context pair, proving it isn't hardcoded to one connector", async () => {
    interface TaskNudgeDraftContext {
      readonly assigneeName: string;
      readonly taskName: string;
    }

    const taskFinding: IntelligenceFinding = {
      ...invoiceFinding(),
      id: "task:org-1:task-1",
      type: "task.overdue",
      entity: { kind: "task", id: "task-1" },
    };
    const nudgeContext: TaskNudgeDraftContext = {
      assigneeName: "Priya Shah",
      taskName: "Follow up with vendor",
    };
    const dispatch: DraftContentDispatch<TaskNudgeDraftContext> = vi.fn(
      async (task: AgentTask, agent: AgentCard) =>
        stubDraftResult(task.id, agent),
    );

    const result = await draftContent(
      "draft_task_nudge",
      "Draft a friendly nudge for this overdue task.",
      taskFinding,
      nudgeContext,
      ALL_AVAILABLE,
      dispatch,
    );

    expect(result.status).toBe("completed");

    const [task, , , context] = vi.mocked(dispatch).mock.calls[0]!;

    expect(task.requestedCapability).toBe("draft_task_nudge");
    expect(context).toBe(nudgeContext);
  });
});
