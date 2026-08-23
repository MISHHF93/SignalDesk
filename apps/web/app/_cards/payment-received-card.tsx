import { CardActions } from "./card-actions";
import { CardFeedbackButtons } from "./card-feedback-buttons";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";
import { formatCardCurrency } from "./format";

/**
 * "What came in" — the one card type today that confirms good news
 * rather than flagging risk (ADR 0022). Mirrors `InvoiceRiskCard`'s shell
 * exactly; the only real difference is what the finding behind it means.
 */
export function PaymentReceivedCard({
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
          {card.financialContext ? (
            <div className="leadValue">
              <span>{card.financialContext.label}</span>
              <strong>
                {formatCardCurrency(
                  card.financialContext.amountCents,
                  card.financialContext.currency,
                )}
              </strong>
            </div>
          ) : null}
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
