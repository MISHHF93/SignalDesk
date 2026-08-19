const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const MAX_JITTER_MS = 500;

/**
 * Retries a request on 429 (rate limited) or 5xx (transient server error),
 * honoring a provider's `Retry-After` header when present — both HubSpot
 * and Slack document this as a real signal to obey, not a suggestion to
 * estimate around, and both use the identical "seconds in Retry-After"
 * convention, so one implementation serves both clients. Falls back to
 * exponential backoff with jitter when the header is absent or
 * unparseable. Any other status (including 4xx auth/validation errors) is
 * returned immediately without retrying, since retrying those would never
 * succeed.
 */
export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit,
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(input, init);

    if (response.ok) {
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
