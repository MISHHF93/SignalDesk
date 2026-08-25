import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchWithRetry } from "./fetch-with-retry";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchWithRetry", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("retries a 5xx by default, preserving every pre-existing call site's behavior", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: "unavailable" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const resultPromise = fetchWithRetry("https://example.test/thing", {
      method: "GET",
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a 429 by default", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate_limited" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const resultPromise = fetchWithRetry("https://example.test/thing", {
      method: "GET",
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("regression: never retries a 5xx when retryable is false, returning the failed response immediately", async () => {
    // A genuinely non-idempotent write (a real email/comment/note send)
    // must never be auto-retried here: a 5xx is not proof the write never
    // took effect server-side, and none of these providers offer an
    // idempotency-key mechanism this app could rely on instead. Retrying
    // blindly risks a real duplicate external side effect.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { error: "unavailable" }),
    );

    const result = await fetchWithRetry(
      "https://example.test/thing",
      { method: "POST" },
      { retryable: false },
    );

    expect(result.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("regression: never retries a 429 when retryable is false either", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: "rate_limited" }),
    );

    const result = await fetchWithRetry(
      "https://example.test/thing",
      { method: "POST" },
      { retryable: false },
    );

    expect(result.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still returns a successful response immediately when retryable is false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await fetchWithRetry(
      "https://example.test/thing",
      { method: "POST" },
      { retryable: false },
    );

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never retries a 4xx regardless of retryable, since it would never succeed", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "bad_request" }),
    );

    const result = await fetchWithRetry(
      "https://example.test/thing",
      { method: "POST" },
      { retryable: true },
    );

    expect(result.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
