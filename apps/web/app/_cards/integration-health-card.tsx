import { getConnectorBySlug } from "@signaldesk/integrations";
import type { IntelligenceCard } from "@signaldesk/schemas";
import Link from "next/link";

import { ConnectorMark } from "../_components/connector-mark";
import { CardBadges, WhyDisclosure } from "./card-shell";

export function IntegrationHealthCard({ card }: { card: IntelligenceCard }) {
  const connector =
    card.entity?.kind === "connector"
      ? getConnectorBySlug(card.entity.id)
      : undefined;

  return (
    <article
      className="attentionCard dynamicCard integrationHealthCard"
      aria-label={card.title}
    >
      <div className="attentionMain">
        <CardBadges card={card} />
        <div className="integrationHealthHeader">
          {connector ? (
            <ConnectorMark connector={connector} size="large" />
          ) : null}
          <h3>{card.title}</h3>
        </div>
        <p>{card.summary}</p>
        <div className="attentionFooter">
          {connector ? (
            <Link
              href={`/integrations/${connector.slug}`}
              className="cardActionButton"
            >
              Connect {connector.name}
            </Link>
          ) : null}
          <WhyDisclosure card={card} />
        </div>
      </div>
    </article>
  );
}
