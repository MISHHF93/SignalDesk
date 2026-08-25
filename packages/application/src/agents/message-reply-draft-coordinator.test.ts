import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type {
  AgentCard,
  AgentTask,
  AgentTaskResult,
} from "@signaldesk/schemas";
import { describe, expect, it, vi } from "vitest";

import {
  draftMessageReply,
  type MessageThreadContext,
} from "./message-reply-draft-coordinator";

const ALL_AVAILABLE = { isAvailable: () => true };
const NONE_AVAILABLE = { isAvailable: () => false };

function messageFinding(): IntelligenceFinding {
  return {
    id: "message:org-1:message-1",
    type: "message.awaiting_reply",
    entity: { kind: "message", id: "message-1" },
    title: "Message from Jane Client awaiting reply",
    summary: "No reply for 96 hours.",
    severity: "medium",
    confidence: 0.9,
    evidence: [],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "no reply past threshold", confidence: "high" },
    detectedAt: new Date(),
  };
}

const THREAD: MessageThreadContext = {
  subject: "Question about my order",
  counterpartyName: "Jane Client",
  counterpartyEmail: "jane@example.com",
  inboundBodyText: "When will my order ship?",
  bodyTruncated: false,
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
      subject: "Re: Question about my order",
      body: "Thanks for reaching out — your order ships tomorrow.",
    },
  };
}

describe("draftMessageReply", () => {
  it("dispatches to an eligible agent and returns its drafted reply", async () => {
    // The full 4-arg shape is required for dispatch.mock.calls[0]'s
    // inferred tuple type below, even though the last two args are unused.
    const dispatch = vi.fn(
      async (
        task: AgentTask,
        agent: AgentCard,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _findings: readonly IntelligenceFinding[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _thread: MessageThreadContext,
      ) => stubDraftResult(task.id, agent),
    );

    const result = await draftMessageReply(
      messageFinding(),
      THREAD,
      ALL_AVAILABLE,
      dispatch,
    );

    expect(result.status).toBe("completed");
    expect(result.draftedContent?.subject).toBe("Re: Question about my order");
    expect(dispatch).toHaveBeenCalledTimes(1);

    const [task, , findings, thread] = dispatch.mock.calls[0]!;

    expect(task.requestedCapability).toBe("draft_customer_reply");
    expect(task.constraints.maxFindings).toBe(1);
    expect(findings).toHaveLength(1);
    expect(thread).toBe(THREAD);
  });

  it("returns a failed result, never throws, when no agent is eligible", async () => {
    const dispatch = vi.fn();

    const result = await draftMessageReply(
      messageFinding(),
      THREAD,
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

    const result = await draftMessageReply(
      messageFinding(),
      THREAD,
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

    const result = await draftMessageReply(
      messageFinding(),
      THREAD,
      deterministicOnly,
      dispatch,
    );

    expect(result.status).toBe("completed");
    expect(dispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "deterministic-specialist" }),
      expect.anything(),
      THREAD,
    );
  });
});
