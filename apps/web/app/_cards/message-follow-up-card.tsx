import { CardActions } from "./card-actions";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";

/**
 * Mirrors `TaskRiskCard` exactly — no financial context, no owner
 * (messages have no owner/assignee concept in this phase), and no
 * `CardFeedbackButtons` (deliberately out of scope for this slice — see
 * docs/adr/0050-gmail-message-ingestion.md's out-of-scope list; wiring it
 * in would need a `card_feedback.card_type` check-constraint migration
 * this phase doesn't otherwise need). The counterparty is already named
 * in `card.summary` (see `evaluateMessageAwaitingReply`,
 * `@signaldesk/domain`), so no separate contact line is needed here.
 */
export function MessageFollowUpCard({
  card,
  createTaskAction,
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
            <h3>{card.title}</h3>
          </div>
        </div>
        <p>{card.summary}</p>
        <div className="attentionFooter">
          <WhyDisclosure card={card} />
          <CardActions card={card} createTaskAction={createTaskAction} />
        </div>
      </div>
    </article>
  );
}
