export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? hours.toString() : hours.toFixed(1);
}

const FRESH_THRESHOLD_MINUTES = 15;
const AGING_THRESHOLD_MINUTES = 120;

export function freshnessStatus(
  sourceFreshnessMinutes: number,
): "fresh" | "aging" | "stale" {
  if (sourceFreshnessMinutes < FRESH_THRESHOLD_MINUTES) return "fresh";
  if (sourceFreshnessMinutes < AGING_THRESHOLD_MINUTES) return "aging";
  return "stale";
}
