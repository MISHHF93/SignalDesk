import { CardActions } from "./card-actions";
import { CardFeedbackButtons } from "./card-feedback-buttons";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";
import { formatCardCurrency } from "./format";

/**
 * The Goal Intelligence Engine's one real card (Prompt 22,
 * docs/product-vision-backlog.md, ADR 0035) — mirrors `InvoiceRiskCard`
 * exactly, except `financialContext` is genuinely absent for a count-unit
 * goal (e.g. task backlog), not just optional by contract, so this never
 * assumes it's present the way every other financial card can.
 */
export function GoalVarianceCard({
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
