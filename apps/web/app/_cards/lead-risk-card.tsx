import { CardActions } from "./card-actions";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";
import { formatCardCurrency } from "./format";

export function LeadRiskCard({ card, createTaskAction }: CardComponentProps) {
  return (
    <article className="attentionCard dynamicCard" aria-label={card.title}>
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
        {card.owner ? (
          <p className="contactName">Owner: {card.owner.name}</p>
        ) : null}
        <div className="attentionFooter">
          <WhyDisclosure card={card} />
          <CardActions card={card} createTaskAction={createTaskAction} />
        </div>
      </div>
    </article>
  );
}
