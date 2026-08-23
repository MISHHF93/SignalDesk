import type { IntelligenceCard } from "@signaldesk/schemas";

/**
 * Fallback for any card whose `type` is not in the registry. The Card
 * Registry must never silently drop or guess at rendering for an
 * unrecognized component — this is that "unknown components must be
 * rejected" rule made visible rather than invisible, in plain language
 * rather than naming the internal registry to the customer.
 */
export function UnknownCard({ card }: { card: IntelligenceCard }) {
  return (
    <article className="attentionCard dynamicCard unknownCard" role="alert">
      <div className="attentionMain">
        <p className="objectBadge">Can&rsquo;t display this item</p>
        <p>
          This item&rsquo;s type ({card.type}) isn&rsquo;t supported yet, so it
          can&rsquo;t be shown here.
        </p>
      </div>
    </article>
  );
}
