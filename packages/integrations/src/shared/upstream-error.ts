/**
 * Thrown when a connector's own HTTP call to a provider fails
 * (`!response.ok`). `message` is always a safe, generic sentence — never
 * the raw upstream response body — so it can be shown to a client
 * verbatim (`apps/web/app/_lib/describe-action-error.ts` already returns
 * any plain `Error`'s `.message` as-is to the UI). The real diagnostic
 * detail (status code + response body) lives in `rawDetail`, read only by
 * server-side logging/error-reporting, never returned to a client.
 *
 * Found by a deep audit (2026-08-22): every connector client previously
 * baked the raw upstream response body directly into `Error.message`
 * (e.g. `` `QuickBooks token request failed: ${status} ${await
 * response.text()}` ``), which `describeActionError` then returned
 * unmodified to the UI on a sync/connect failure — a real, if narrow,
 * information-disclosure gap (the viewer must already be an
 * authenticated member of the org, but a provider's raw gateway/error
 * page text was never meant to reach a client response).
 *
 * `status`/`retryAfterSeconds` (ADR 0058's Pre-Flight/recovery-classification
 * work) are the real, structured facts a caller needs to tell a genuinely
 * different failure ("reconnect" vs. "try again shortly" vs. "this record
 * may have been deleted") apart — deliberately `number | null`, not
 * defaulted, so every construction site states plainly whether it has a
 * real HTTP status to report. Several providers' APIs return `200 OK` even
 * on a real failure (Slack's Web API, a GraphQL error body) — `null` there
 * is the honest value, not a fabricated 200.
 */
export class UpstreamProviderError extends Error {
  readonly rawDetail: string;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    safeMessage: string,
    rawDetail: string,
    status: number | null,
    retryAfterSeconds: number | null = null,
  ) {
    super(safeMessage);
    this.name = "UpstreamProviderError";
    this.rawDetail = rawDetail;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Parses a standard `Retry-After` header (seconds, or an HTTP-date) into
 * whole seconds from now — `null` when absent or unparseable, never a
 * guessed default. */
function parseRetryAfterSeconds(response: Response): number | null {
  const header = response.headers.get("retry-after");

  if (!header) {
    return null;
  }

  const asSeconds = Number(header);

  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds);
  }

  const asDate = Date.parse(header);

  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.max(0, Math.round((asDate - Date.now()) / 1000));
}

/**
 * Builds the safe/raw pair for a failed provider HTTP call and throws it.
 * `operation` is a short, human phrase for what was being attempted (e.g.
 * "QuickBooks token request") — shown to the user; the response's status
 * and body are captured in `rawDetail` for server-side diagnostics only.
 * The real HTTP status and any `Retry-After` header are always available
 * here (this is a genuine `Response`), so both are captured on the thrown
 * error for a caller that wants to classify the failure.
 */
export async function throwUpstreamError(
  operation: string,
  response: Response,
): Promise<never> {
  const rawDetail = `${response.status} ${await response.text()}`;

  throw new UpstreamProviderError(
    `${operation} failed. Please try again, or reconnect this integration if the problem continues.`,
    rawDetail,
    response.status,
    parseRetryAfterSeconds(response),
  );
}
