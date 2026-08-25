import { randomUUID } from "node:crypto";

import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type {
  AgentCard,
  AgentTask,
  AgentTaskResult,
} from "@signaldesk/schemas";

import { selectAgent, type AgentAvailability } from "./agent-router";

const MAX_FINDINGS_PER_TASK = 1;

/**
 * The real, already-ingested inbound message a reply is being drafted for —
 * never fetched by this coordinator itself (packages/application has no
 * persistence dependency); the caller (draft-message-reply-action.ts,
 * apps/web) resolves it via `getMessageDraftContext`, the one sanctioned
 * read of message body content above the ingest boundary.
 */
export interface MessageThreadContext {
  readonly subject: string;
  readonly counterpartyName: string | null;
  readonly counterpartyEmail: string;
  readonly inboundBodyText: string;
  readonly bodyTruncated: boolean;
}

/**
 * The real trust boundary this coordinator dispatches through — the same
 * shape as `SpecialistDispatch` (parallel-specialist-coordinator.ts), widened
 * with `thread` since drafting needs real message content a finding alone
 * never carries. The real implementation
 * (`AgentGatewayService.dispatchMessageDraft`, apps/web/app/_lib/agent-gateway.ts)
 * mints a capability grant, calls a real provider, and writes the audit
 * trail; this coordinator only ever sees the typed result.
 */
export interface MessageReplyDispatch {
  (
    task: AgentTask,
    agent: AgentCard,
    findings: readonly IntelligenceFinding[],
    thread: MessageThreadContext,
  ): Promise<AgentTaskResult>;
}

/**
 * Drafts a reply to exactly one `message.awaiting_reply` finding. A small,
 * single-specialist orchestration path — deliberately NOT a mode of
 * `runParallelSpecialists`, which stays reserved for the business-wide
 * finance/delivery/ticket sweep. Never throws: a routing or dispatch
 * failure becomes an honest `status: "failed"` result, the same isolation
 * doctrine `dispatchOrFail` already establishes for the parallel case, so a
 * caller can always show "couldn't draft a reply right now" rather than an
 * uncaught rejection.
 */
export async function draftMessageReply(
  finding: IntelligenceFinding,
  thread: MessageThreadContext,
  availability: AgentAvailability,
  dispatch: MessageReplyDispatch,
): Promise<AgentTaskResult> {
  let agent: AgentCard;

  try {
    agent = selectAgent("draft_customer_reply", availability);
  } catch (error) {
    return {
      taskId: `task:draft_customer_reply:${randomUUID()}`,
      agentId: "unknown",
      status: "failed",
      claims: [],
      evidenceIds: [],
      confidence: 0,
      limitations: [error instanceof Error ? error.message : "Unknown error"],
    };
  }

  const task: AgentTask = {
    id: `task:draft_customer_reply:${randomUUID()}`,
    objective:
      "Draft a professional reply to this unanswered customer message, grounded only in its real subject and body.",
    requestedCapability: "draft_customer_reply",
    contextRefs: [...finding.evidence],
    constraints: {
      maxFindings: MAX_FINDINGS_PER_TASK,
      mustNotInventFacts: true,
    },
  };

  try {
    return await dispatch(task, agent, [finding], thread);
  } catch (error) {
    return {
      taskId: task.id,
      agentId: agent.id,
      status: "failed",
      claims: [],
      evidenceIds: [],
      confidence: 0,
      limitations: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}
