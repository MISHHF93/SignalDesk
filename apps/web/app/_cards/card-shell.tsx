import type { IntelligenceCard } from "@business-dashboard/schemas";

import { formatRelativeTime } from "./format";

const severityLabel: Record<IntelligenceCard["severity"], string> = {
  info: "Info",
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
  critical: "Critical",
};

const freshnessLabel: Record<IntelligenceCard["freshness"]["status"], string> =
  {
    fresh: "Fresh",
    aging: "Aging",
    stale: "Stale",
    unknown: "Freshness unknown",
  };

export function CardBadges({ card }: { card: IntelligenceCard }) {
  return (
    <div className="badgeRow">
      <span className="priorityBadge" data-severity={card.severity}>
        {severityLabel[card.severity]}
      </span>
      <span className="objectBadge">{card.type.replace("_", " ")}</span>
    </div>
  );
}

/**
 * The universal "Why am I seeing this?" interaction: every field here is
 * sourced from the card's real `explanation`/`sources`/`freshness` data,
 * never template filler (see README's explainability requirement).
 */
export function WhyDisclosure({ card }: { card: IntelligenceCard }) {
  return (
    <details className="evidenceDetails">
      <summary>Why am I seeing this?</summary>
      <div className="evidencePanel">
        <dl>
          <div>
            <dt>Trigger</dt>
            <dd>{card.explanation.trigger}</dd>
          </div>
          {card.explanation.observedValue ? (
            <div>
              <dt>Observed</dt>
              <dd>{card.explanation.observedValue}</dd>
            </div>
          ) : null}
          {card.explanation.expectedBaseline ? (
            <div>
              <dt>Baseline</dt>
              <dd>{card.explanation.expectedBaseline}</dd>
            </div>
          ) : null}
          <div>
            <dt>Confidence</dt>
            <dd>{card.explanation.confidence}</dd>
          </div>
        </dl>

        {card.sources.length > 0 ? (
          <>
            <h4>Source evidence</h4>
            <ul>
              {card.sources.map((source) => (
                <li
                  key={`${source.integrationId}:${source.externalRecordId}:${source.sourceVersion}`}
                >
                  <span>{source.system}</span>
                  <code>
                    {source.integrationId} / {source.externalRecordId} @{" "}
                    {source.sourceVersion}
                  </code>
                  <code className="evidenceDigest">
                    sha256:{source.recordDigestSha256}
                  </code>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>No source record backs this card; it reflects catalog metadata.</p>
        )}

        <p>
          {freshnessLabel[card.freshness.status]} · synced{" "}
          {formatRelativeTime(card.freshness.asOf, new Date())}
        </p>
      </div>
    </details>
  );
}
