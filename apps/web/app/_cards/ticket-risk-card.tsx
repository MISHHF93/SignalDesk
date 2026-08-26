import { CardShell } from "./card-shell";
import type { CardComponentProps } from "./card-types";
import { DraftActionButton } from "./draft-action-button";

/**
 * The title links to `/tickets/{card.entity.id}` — the real
 * `support_tickets.id` `composeCards` already carries onto the card via
 * `finding.entity` — opening as a Level-3 drawer over the still-visible
 * command center (`@modal/(.)tickets/[id]`), not a full page navigation.
 * `card.entity` is optional on the schema; falling back to plain text
 * when absent is a real, not just defensive, case (a card without a
 * single-entity reference has nothing to link to).
 *
 * The "Draft reply" button (ADR 0057) fires `draftTicketReplyAction`
 * immediately — no approval gate here, since drafting has no external
 * effect, mirroring `MessageFollowUpCard`/`TaskRiskCard`'s own draft
 * buttons exactly. Its result is a separate `agent_recommendation` card,
 * handed to `onAgentCardProduced` — the actual send is approved from that
 * card, via `AgentRecommendationCard`.
 */
export function TicketRiskCard({
  card,
  createTaskAction,
  recordCardFeedbackAction,
  draftTicketReplyAction,
  onAgentCardProduced,
}: CardComponentProps) {
  return (
    <CardShell
      card={card}
      createTaskAction={createTaskAction}
      ownerLabel="Assignee"
      {...(card.entity ? { titleHref: `/tickets/${card.entity.id}` } : {})}
      {...(recordCardFeedbackAction ? { recordCardFeedbackAction } : {})}
      footerActions={
        draftTicketReplyAction &&
        card.entity &&
        card.entity.kind === "support_ticket" ? (
          <DraftActionButton
            entityId={card.entity.id}
            action={draftTicketReplyAction}
            idleLabel="Draft reply"
            errorPrefix="Couldn't draft a reply."
            {...(onAgentCardProduced ? { onAgentCardProduced } : {})}
          />
        ) : null
      }
    />
  );
}
