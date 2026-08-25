import type { UpstreamProviderError } from "@signaldesk/integrations/shared/upstream-error";

/**
 * A real, deterministic recovery classification for a failed connector
 * write — the honest, buildable-now slice of the "Resilience & Self-Healing
 * Agent" concept from the fuller Devin/BizOps proposal
 * (`docs/product-vision-backlog.md`, "AI Business Operator" entry). That
 * proposal's recovery matrix (401→reauth, 429→backoff+retry, 409→refetch,
 * 404→entity lookup, unrecoverable→escalate) assumed a background job
 * runner that could actually wait and retry automatically — this app has
 * none (the same gap the Zero-Prompt AI backlog entry already names), so
 * this does NOT auto-retry anything. What it does today: give the operator
 * an honest, specific, actionable explanation instead of one generic "try
 * again or reconnect" sentence for every failure — the part of the concept
 * that needed no new infrastructure to build for real.
 *
 * Every already-approved action here was already approved by a human — a
 * classification (or a future retry built on top of one) never proposes a
 * new mutation, only explains or re-attempts the exact one already
 * approved. No AI call: every branch below is a deterministic read of a
 * real HTTP status code, never a judgment call.
 */

export type RecoveryStrategy =
  | "reauth_required"
  | "rate_limited"
  | "conflict"
  | "entity_not_found"
  | "unrecoverable";

export interface RecoveryClassification {
  readonly strategy: RecoveryStrategy;
  readonly message: string;
  /** Present only when `strategy === "reauth_required"` — the real
   * `/integrations/[slug]` connector slug, so a caller can turn "reconnect
   * X" from a dead-end sentence into an actual one-click link instead of
   * making the operator go find the reconnect page themselves. */
  readonly reconnectSlug?: string;
}

export interface RecoveryContext {
  /** The provider's display name, e.g. "QuickBooks". */
  readonly providerName: string;
  /** A short, capitalized reference to the entity being acted on, e.g.
   * "This invoice". */
  readonly entityLabel: string;
  /** This connector's real catalog slug (`packages/integrations/src/index.ts`),
   * e.g. "quickbooks" — used to build the `reconnectSlug` above. */
  readonly connectorSlug: string;
}

function formatWait(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) {
    return "in a few minutes";
  }

  if (retryAfterSeconds < 60) {
    return `in about ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}`;
  }

  const minutes = Math.round(retryAfterSeconds / 60);

  return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/**
 * Classifies a real `UpstreamProviderError` into one of five real
 * strategies, purely from its `status` (and, for a rate limit, the real
 * `Retry-After` header value when the provider sent one). A `status` of
 * `null` (a provider whose API returns 200 even on failure — Slack, a
 * GraphQL error body) or any status not specifically handled below falls
 * through to `unrecoverable`, using the error's own already-safe message
 * rather than inventing a more specific claim this app can't actually
 * verify.
 */
export function classifyRecoveryStrategy(
  error: UpstreamProviderError,
  context: RecoveryContext,
): RecoveryClassification {
  if (error.status === 401 || error.status === 403) {
    return {
      strategy: "reauth_required",
      message: `Reconnect ${context.providerName} — its access appears to have expired.`,
      reconnectSlug: context.connectorSlug,
    };
  }

  if (error.status === 429) {
    return {
      strategy: "rate_limited",
      message: `${context.providerName} is temporarily rate-limiting this workspace. Try approving again ${formatWait(error.retryAfterSeconds)}.`,
    };
  }

  if (error.status === 409) {
    return {
      strategy: "conflict",
      message: `${context.entityLabel} may have changed in ${context.providerName} since this was drafted. Refresh and try approving again.`,
    };
  }

  if (error.status === 404) {
    return {
      strategy: "entity_not_found",
      message: `${context.entityLabel} could not be found in ${context.providerName} — it may have been deleted or moved there.`,
    };
  }

  return { strategy: "unrecoverable", message: error.message };
}
