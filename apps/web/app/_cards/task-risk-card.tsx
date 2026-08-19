import { CardActions } from "./card-actions";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";

export function TaskRiskCard({ card, createTaskAction }: CardComponentProps) {
  return (
    <article className="attentionCard dynamicCard" aria-label={card.title}>
      <div className="priorityRail" aria-hidden="true" />
      <div className="attentionMain">
        <div className="attentionHeader">
          <div>
            <CardBadges card={card} />
            <h3>{card.title}</h3>
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
