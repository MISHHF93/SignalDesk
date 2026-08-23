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
 */
export class UpstreamProviderError extends Error {
  readonly rawDetail: string;

  constructor(safeMessage: string, rawDetail: string) {
    super(safeMessage);
    this.name = "UpstreamProviderError";
    this.rawDetail = rawDetail;
  }
}

/**
 * Builds the safe/raw pair for a failed provider HTTP call and throws it.
 * `operation` is a short, human phrase for what was being attempted (e.g.
 * "QuickBooks token request") — shown to the user; the response's status
 * and body are captured in `rawDetail` for server-side diagnostics only.
 */
export async function throwUpstreamError(
  operation: string,
  response: Response,
): Promise<never> {
  const rawDetail = `${response.status} ${await response.text()}`;

  throw new UpstreamProviderError(
    `${operation} failed. Please try again, or reconnect this integration if the problem continues.`,
    rawDetail,
  );
}
