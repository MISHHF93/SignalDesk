import { CardActions } from "./card-actions";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";

export function StuckCard({ card, createTaskAction }: CardComponentProps) {
  return (
    <article className="attentionCard dynamicCard" aria-label={card.title}>
      <div className="priorityRail" aria-hidden="true" />
      <div className="attentionMain">
        <CardBadges card={card} />
        <h3>{card.title}</h3>
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
