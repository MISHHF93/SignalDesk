import { CardShell } from "./card-shell";
import type { CardComponentProps } from "./card-types";
import { DraftActionButton } from "./draft-action-button";

/**
 * Mirrors `TaskRiskCard` exactly — no financial context, no owner
 * (messages have no owner/assignee concept in this phase). The
 * counterparty is already named in `card.summary` (see
 * `evaluateMessageAwaitingReply`, `@signaldesk/domain`), so no separate
 * contact line is needed here.
 *
 * The "Draft a reply" button (ADR 0056) fires `draftMessageReplyAction`
 * immediately — no approval gate here, since drafting has no external
 * effect. Its result is a separate `agent_recommendation` card (not a
 * change to this one), handed to `onAgentCardProduced` to join the board's
 * own card list — the actual send is approved from that card, via
 * `AgentRecommendationCard`.
 */
export function MessageFollowUpCard({
  card,
  createTaskAction,
  recordCardFeedbackAction,
  draftMessageReplyAction,
  onAgentCardProduced,
}: CardComponentProps) {
  return (
    <CardShell
      card={card}
      createTaskAction={createTaskAction}
      {...(recordCardFeedbackAction ? { recordCardFeedbackAction } : {})}
      footerActions={
        draftMessageReplyAction &&
        card.entity &&
        card.entity.kind === "message" ? (
          <DraftActionButton
            entityId={card.entity.id}
            action={draftMessageReplyAction}
            idleLabel="Draft a reply"
            errorPrefix="Couldn't draft a reply."
            {...(onAgentCardProduced ? { onAgentCardProduced } : {})}
          />
        ) : null
      }
    />
  );
}
