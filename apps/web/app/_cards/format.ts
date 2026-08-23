export function formatCardCurrency(
  amountCents: number,
  currency: string,
): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

/**
 * Real event-type strings use two conventions depending on origin:
 * underscore-separated for `internal_cost_events` (e.g.
 * `claude_specialist_invocation`) and dot-separated `domain.action` for
 * general `audit_events` (e.g. `sync.completed`, `integration.connected`)
 * — split on both rather than assuming one.
 */
const EVENT_TYPE_WORD_OVERRIDES: Record<string, string> = {
  ai: "AI",
};

export function formatEventType(eventType: string): string {
  return eventType
    .split(/[._]/)
    .map(
      (word) =>
        EVENT_TYPE_WORD_OVERRIDES[word.toLowerCase()] ??
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function formatRelativeTime(date: Date, now: Date): string {
  const elapsedMinutes = Math.max(
    0,
    Math.round((now.getTime() - date.getTime()) / (60 * 1_000)),
  );

  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.round(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}
