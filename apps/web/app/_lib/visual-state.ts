import type { ConnectorHealth } from "@signaldesk/persistence";
import type { IntelligenceCard } from "@signaldesk/schemas";

import { formatRelativeTime } from "../_cards/format";

/**
 * The one real anchor point for this app's "state drives color/label"
 * proposal (see `docs/product-vision-backlog.md`'s state-driven visual
 * design system entry) — deliberately just an extraction of what already
 * existed scattered across `card-shell.tsx` and `integrations/page.tsx`,
 * not the proposal's full 14-state vocabulary (`neutral`/`attention`/
 * `warning`/`approval`/`executing`/`verified`/... never adopted since none
 * of those states have real data backing them yet: `CardSeverity` only
 * has 5 values, and there is no "resolved"/"success"/"degraded" concept
 * anywhere in the schema). Extend this file, don't replace it, the day a
 * sixth real state exists.
 */

export const CARD_SEVERITY_LABELS: Record<
  IntelligenceCard["severity"],
  string
> = {
  info: "Info",
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
  critical: "Critical",
};

export const CARD_FRESHNESS_LABELS: Record<
  IntelligenceCard["freshness"]["status"],
  string
> = {
  fresh: "Fresh",
  aging: "Aging",
  stale: "Stale",
  unknown: "Freshness unknown",
};

/**
 * The connector/coverage status vocabulary (`"none" | "partial" |
 * "connected"`) is real but distinct from `CardSeverity` — it describes an
 * integration purpose's connection state, not a finding's priority. Kept
 * as its own resolver rather than folded into the severity labels above,
 * since conflating the two would misrepresent what each actually means.
 * Previously duplicated verbatim at two call sites in
 * `apps/web/app/integrations/page.tsx`.
 */
export function describeCoverageStatus(coverage: {
  readonly status: "none" | "partial" | "connected";
  readonly connectedConnectorNames: readonly string[];
  readonly totalConnectorNames: readonly string[];
}): string {
  if (coverage.status === "connected") {
    return "Live";
  }

  if (coverage.status === "partial") {
    return `${coverage.connectedConnectorNames.length} of ${coverage.totalConnectorNames.length} live`;
  }

  return "Not connected";
}

/**
 * A calm, single-line resolver for `ConnectorHealth` (ADR 0021) — the
 * narrow real first slice of the Resilience proposal's "calm, precise
 * status" idea (`docs/product-vision-backlog.md`, Prompt 18: "Salesforce
 * updates delayed · last successful sync 18 min ago" rather than a
 * generic error). Reuses `formatRelativeTime` (already used by cards) so
 * this reads consistently with the rest of the page; adds no new data —
 * `ConnectorHealth` is already real, derived, and tested (ADR 0021).
 */
export function describeConnectorHealth(
  health: Pick<ConnectorHealth, "status" | "lastSuccessfulSyncAt">,
  now: Date,
): string {
  if (health.status === "unknown") {
    return "Awaiting first sync";
  }

  const freshness = health.lastSuccessfulSyncAt
    ? `last synced ${formatRelativeTime(health.lastSuccessfulSyncAt, now)}`
    : "never synced successfully";

  if (health.status === "healthy") {
    return `Live · ${freshness}`;
  }

  if (health.status === "degraded") {
    return `Updates delayed · ${freshness}`;
  }

  return `Sync failing · ${freshness}`;
}

/**
 * The one real onboarding milestone (Prompt 37, docs/product-vision-
 * backlog.md, ADR 0046): real elapsed time between signing up and the
 * first successful sync, honestly `null` until one has actually
 * happened — never a placeholder countdown or guessed estimate.
 */
export function describeTimeToFirstSync(
  minutesToFirstSync: number | null,
): string {
  if (minutesToFirstSync === null) {
    return "Still waiting on your first successful sync — connect a tool above to get real data flowing.";
  }

  if (minutesToFirstSync < 60) {
    return `Your first real data synced ${minutesToFirstSync} minute${minutesToFirstSync === 1 ? "" : "s"} after you signed up.`;
  }

  const hours = Math.round(minutesToFirstSync / 60);

  if (hours < 24) {
    return `Your first real data synced ${hours} hour${hours === 1 ? "" : "s"} after you signed up.`;
  }

  const days = Math.round(hours / 24);
  return `Your first real data synced ${days} day${days === 1 ? "" : "s"} after you signed up.`;
}
