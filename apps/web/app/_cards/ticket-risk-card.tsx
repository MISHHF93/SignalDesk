import Link from "next/link";

import { CardActions } from "./card-actions";
import { CardFeedbackButtons } from "./card-feedback-buttons";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";

/**
 * Mirrors `TaskRiskCard`'s owner line and, since migration 0055
 * (`card_feedback_type_sync.sql`) widened `card_feedback_card_type_allowed`
 * to cover every real card type, its `CardFeedbackButtons` too — an
 * earlier version of this comment claimed the constraint still blocked
 * `ticket_risk`/`ownership_gap`/`message_follow_up`, which was true when
 * written but stale by the time it was re-checked (2026-08-23): the
 * constraint has covered all three since 0055 landed, the missing piece
 * was only ever this component never rendering the button.
 *
 * The title links to `/tickets/{card.entity.id}` — the real
 * `support_tickets.id` `composeCards` already carries onto the card via
 * `finding.entity` — opening as a Level-3 drawer over the still-visible
 * command center (`@modal/(.)tickets/[id]`), not a full page navigation.
 * `card.entity` is optional on the schema; falling back to plain text
 * when absent is a real, not just defensive, case (a card without a
 * single-entity reference has nothing to link to).
 */
export function TicketRiskCard({
  card,
  createTaskAction,
  recordCardFeedbackAction,
}: CardComponentProps) {
  return (
    <article
      className="attentionCard dynamicCard"
      data-severity={card.severity}
      aria-label={card.title}
    >
      <div className="priorityRail" aria-hidden="true" />
      <div className="attentionMain">
        <div className="attentionHeader">
          <div>
            <CardBadges card={card} />
            {card.entity ? (
              <h3>
                <Link href={`/tickets/${card.entity.id}`}>{card.title}</Link>
              </h3>
            ) : (
              <h3>{card.title}</h3>
            )}
          </div>
        </div>
        <p>{card.summary}</p>
        {card.owner ? (
          <p className="contactName">Assignee: {card.owner.name}</p>
        ) : null}
        <div className="attentionFooter">
          <WhyDisclosure card={card} />
          <CardActions card={card} createTaskAction={createTaskAction} />
        </div>
        {recordCardFeedbackAction ? (
          <CardFeedbackButtons
            card={card}
            recordCardFeedbackAction={recordCardFeedbackAction}
          />
        ) : null}
      </div>
    </article>
  );
}
