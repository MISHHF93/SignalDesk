const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const MAX_JITTER_MS = 500;

export interface FetchWithRetryOptions {
  /**
   * Whether a non-ok response is even eligible for a retry at all — default
   * `true`, preserving every pre-existing call site's behavior. Set `false`
   * for a genuinely non-idempotent write with no provider-side dedup
   * mechanism (no idempotency-key support): a real customer-facing send
   * (Gmail's message send, Asana's/HubSpot's/Zendesk's comment-or-note
   * write, QuickBooks's memo update and invoice send). A 5xx from a
   * provider is not proof the request never took effect server-side — a
   * gateway timeout, a dropped connection after the write committed — so
   * blindly retrying one of these specific calls risks a real duplicate
   * external side effect (two Asana comments, two sent emails) that no
   * amount of this app's own send-tracking idempotency can undo once it
   * happens. Reads and any other naturally-idempotent or no-side-effect
   * call keep retrying as before.
   *
   * Real bug found by review: this used to also claim "OAuth token
   * exchange/refresh/revoke... keep retrying," on the assumption that
   * resending the same code/refresh-token is always harmless. That only
   * holds for a provider that doesn't rotate credentials on use (Google —
   * confirmed non-rotating, `google-oauth.ts`'s own doc comment). An
   * authorization `code` is single-use by the OAuth spec itself
   * regardless of provider, and QuickBooks/Zendesk/Jira all confirm they
   * rotate the refresh token on every use — for any of those, the same
   * "gateway timeout after the write committed" risk above applies
   * identically to a token exchange/refresh: retrying resends an
   * already-consumed credential, which the provider correctly rejects,
   * permanently losing the one real new token pair that was already
   * issued but never received. Every token exchange/refresh call for
   * those three providers opts out via `{ retryable: false }` (see
   * `refreshQuickBooksAccessToken`/`requestZendeskToken`/
   * `requestJiraToken`'s own doc comments); revoke calls stay retryable
   * (an already-revoked token being revoked again is a genuine no-op).
   */
  readonly retryable?: boolean;
}

/**
 * Retries a request on 429 (rate limited) or 5xx (transient server error),
 * honoring a provider's `Retry-After` header when present — both HubSpot
 * and Slack document this as a real signal to obey, not a suggestion to
 * estimate around, and both use the identical "seconds in Retry-After"
 * convention, so one implementation serves both clients. Falls back to
 * exponential backoff with jitter when the header is absent or
 * unparseable. Any other status (including 4xx auth/validation errors) is
 * returned immediately without retrying, since retrying those would never
 * succeed. See `FetchWithRetryOptions.retryable` for the one case this
 * function refuses to retry even a 429/5xx.
 */
export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit,
  options?: FetchWithRetryOptions,
): Promise<Response> {
  const retryable = options?.retryable ?? true;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(input, init);

    if (response.ok) {
      return response;
    }

    if (!retryable) {
      return response;
    }

    const isRetryable = response.status === 429 || response.status >= 500;

    if (!isRetryable || attempt === MAX_RETRIES) {
      return response;
    }

    // `Headers.get()` returns `null` when the header is absent, and
    // `Number(null) === 0` — which `Number.isFinite` treats as a legitimate
    // zero-second delay, silently skipping exponential backoff entirely on
    // every bare 5xx (the common case). Only parse when the header is
    // actually present.
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds =
      retryAfterHeader !== null ? Number(retryAfterHeader) : NaN;
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : BASE_BACKOFF_MS * 2 ** attempt;

    await new Promise((resolve) =>
      setTimeout(resolve, delayMs + Math.random() * MAX_JITTER_MS),
    );
  }

  // Unreachable: the loop always returns by attempt === MAX_RETRIES.
  throw new Error("fetchWithRetry: exhausted retries without a response");
}
