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
