import Link from "next/link";

import { CardActions } from "./card-actions";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";

/**
 * Mirrors `TaskRiskCard`'s owner line but `MessageFollowUpCard`'s
 * omission of `CardFeedbackButtons` — `card_feedback_card_type_allowed`
 * (`packages/persistence/src/schema.ts`) is a stale check constraint that
 * already doesn't cover `ownership_gap`/`message_follow_up` either;
 * widening it is a pre-existing, disclosed gap unrelated to this
 * connector, not something to silently fix as a side effect here.
 *
 * The title links to `/tickets/{card.entity.id}` — the real
 * `support_tickets.id` `composeCards` already carries onto the card via
 * `finding.entity` — opening as a Level-3 drawer over the still-visible
 * command center (`@modal/(.)tickets/[id]`), not a full page navigation.
 * `card.entity` is optional on the schema; falling back to plain text
 * when absent is a real, not just defensive, case (a card without a
 * single-entity reference has nothing to link to).
 */
export function TicketRiskCard({ card, createTaskAction }: CardComponentProps) {
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
      </div>
    </article>
  );
}
