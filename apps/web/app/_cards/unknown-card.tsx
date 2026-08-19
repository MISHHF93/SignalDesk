import type { IntelligenceCard } from "@signaldesk/schemas";

/**
 * Fallback for any card whose `type` is not in the registry. The Card
 * Registry must never silently drop or guess at rendering for an
 * unrecognized component — this is that "unknown components must be
 * rejected" rule made visible rather than invisible.
 */
export function UnknownCard({ card }: { card: IntelligenceCard }) {
  return (
    <article className="attentionCard dynamicCard unknownCard" role="alert">
      <div className="attentionMain">
        <p className="objectBadge">Unrecognized card type: {card.type}</p>
        <p>
          This card type is not registered in the Card Registry and cannot be
          rendered.
        </p>
      </div>
    </article>
  );
}
