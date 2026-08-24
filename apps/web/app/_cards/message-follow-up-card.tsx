import { CardActions } from "./card-actions";
import { CardFeedbackButtons } from "./card-feedback-buttons";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";

/**
 * Mirrors `TaskRiskCard` exactly — no financial context, no owner
 * (messages have no owner/assignee concept in this phase). Re-checked
 * 2026-08-23: this comment previously said `CardFeedbackButtons` was out
 * of scope pending a `card_feedback.card_type` check-constraint
 * migration — migration 0055 (`card_feedback_type_sync.sql`) already
 * widened that constraint to cover `message_follow_up` (and every other
 * real card type), so the prerequisite this note described is done; the
 * button is wired in below like every other risk-finding card. The
 * counterparty is already named in `card.summary` (see
 * `evaluateMessageAwaitingReply`, `@signaldesk/domain`), so no separate
 * contact line is needed here.
 */
export function MessageFollowUpCard({
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
            <h3>{card.title}</h3>
          </div>
        </div>
        <p>{card.summary}</p>
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
