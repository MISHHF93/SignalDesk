import { getSourceSystemLabel } from "@signaldesk/integrations";
import type { IntelligenceCard } from "@signaldesk/schemas";

import {
  CARD_FRESHNESS_LABELS,
  CARD_SEVERITY_LABELS,
} from "../_lib/visual-state";
import { formatRelativeTime } from "./format";

export function CardBadges({ card }: { card: IntelligenceCard }) {
  const relatedCount = card.relatedFindingIds?.length ?? 0;

  return (
    <div className="badgeRow">
      <span className="priorityBadge" data-severity={card.severity}>
        {CARD_SEVERITY_LABELS[card.severity]}
      </span>
      <span className="objectBadge">{card.type.replace(/_/g, " ")}</span>
      {relatedCount > 0 ? (
        <span
          className="relatedBadge"
          title={`${relatedCount} other item${relatedCount === 1 ? "" : "s"} on this page mention the same customer — may describe the same real situation, not necessarily duplicates.`}
        >
          +{relatedCount} related
        </span>
      ) : null}
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
              {Array.from(
                card.sources
                  .reduce((bySystem, source) => {
                    const label = getSourceSystemLabel(source.system);
                    bySystem.set(label, (bySystem.get(label) ?? 0) + 1);
                    return bySystem;
                  }, new Map<string, number>())
                  .entries(),
              ).map(([label, recordCount]) => (
                <li key={label}>
                  <span>{label}</span>
                  <span>
                    {recordCount} record{recordCount === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>No source record backs this card; it reflects catalog metadata.</p>
        )}

        <p>
          {CARD_FRESHNESS_LABELS[card.freshness.status]} · synced{" "}
          {formatRelativeTime(card.freshness.asOf, new Date())}
        </p>
      </div>
    </details>
  );
}
