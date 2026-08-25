import { randomUUID } from "node:crypto";

import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type {
  AgentCapability,
  AgentCard,
  AgentTask,
  AgentTaskResult,
} from "@signaldesk/schemas";

import { selectAgent, type AgentAvailability } from "./agent-router";

const MAX_FINDINGS_PER_TASK = 1;

/**
 * The real trust boundary this coordinator dispatches through, generic over
 * the connector-specific context shape a draft task needs (see
 * `InvoiceReminderDraftContext`/`TaskNudgeDraftContext`/`DealNoteDraftContext`/
 * `TicketReplyDraftContext`, @signaldesk/application's ai-provider.ts). The
 * real implementation (`AgentGatewayService.dispatchContentDraft`,
 * apps/web/app/_lib/agent-gateway.ts) mints a capability grant, calls a real
 * provider, and writes the audit trail; this coordinator only ever sees the
 * typed result.
 */
export interface DraftContentDispatch<TContext> {
  (
    task: AgentTask,
    agent: AgentCard,
    findings: readonly IntelligenceFinding[],
    context: TContext,
  ): Promise<AgentTaskResult>;
}

/**
 * Generalizes `message-reply-draft-coordinator.ts`'s `draftMessageReply` for
 * every non-Gmail draft-then-approve write action (ADR 0057: QuickBooks
 * invoice reminders, Asana task nudges, HubSpot deal notes, Zendesk ticket
 * replies) — same single-specialist orchestration shape, parametrized by
 * `capability` and generic over the context type instead of hardcoding
 * `"draft_customer_reply"`/`MessageThreadContext`. Gmail's own coordinator
 * stays untouched (it's live) — this is additive, used only by the four
 * newer connectors.
 *
 * Drafts a reply/reminder/nudge/note for exactly one finding. Deliberately
 * NOT a mode of `runParallelSpecialists`, which stays reserved for the
 * business-wide finance/delivery/ticket sweep. Never throws: a routing or
 * dispatch failure becomes an honest `status: "failed"` result, so a caller
 * can always show "couldn't draft this right now" rather than an uncaught
 * rejection.
 */
export async function draftContent<TContext>(
  capability: AgentCapability,
  objective: string,
  finding: IntelligenceFinding,
  context: TContext,
  availability: AgentAvailability,
  dispatch: DraftContentDispatch<TContext>,
): Promise<AgentTaskResult> {
  let agent: AgentCard;

  try {
    agent = selectAgent(capability, availability);
  } catch (error) {
    return {
      taskId: `task:${capability}:${randomUUID()}`,
      agentId: "unknown",
      status: "failed",
      claims: [],
      evidenceIds: [],
      confidence: 0,
      limitations: [error instanceof Error ? error.message : "Unknown error"],
    };
  }

  const task: AgentTask = {
    id: `task:${capability}:${randomUUID()}`,
    objective,
    requestedCapability: capability,
    contextRefs: [...finding.evidence],
    constraints: {
      maxFindings: MAX_FINDINGS_PER_TASK,
      mustNotInventFacts: true,
    },
  };

  try {
    return await dispatch(task, agent, [finding], context);
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
