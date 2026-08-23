import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchHubSpotDealsModifiedSince,
  fetchHubSpotOwners,
  revokeHubSpotRefreshToken,
} from "./client";

function jsonResponse(
  status: number,
  body: unknown,
  headers: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("HubSpot client retry/backoff", () => {
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

  it("returns immediately on a successful response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { results: [] }));

    const owners = await fetchHubSpotOwners("token");

    expect(owners).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and honors the Retry-After header", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(429, { message: "rate limited" }, { "Retry-After": "2" }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { results: [] }));

    const resultPromise = fetchHubSpotOwners("token");

    await vi.runAllTimersAsync();

    const owners = await resultPromise;

    expect(owners).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on a 5xx with exponential backoff when no Retry-After is present", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { message: "unavailable" }))
      .mockResolvedValueOnce(jsonResponse(200, { results: [] }));
    // `Headers.get()` returns `null` (not "0") when the header is genuinely
    // absent — `Number(null) === 0` would previously slip past
    // `Number.isFinite` and skip backoff entirely, so this asserts the
    // actual delay used, not just that a retry eventually happened.
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const resultPromise = fetchHubSpotOwners("token");

    await vi.runAllTimersAsync();

    const owners = await resultPromise;

    expect(owners).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, delayMs] = setTimeoutSpy.mock.calls[0]!;
    expect(delayMs as number).toBeGreaterThanOrEqual(500);
  });

  it("does not retry a non-retryable 4xx error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { message: "unauthorized" }),
    );

    await expect(fetchHubSpotOwners("token")).rejects.toThrow(
      /HubSpot owners fetch failed/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("paginates through multiple pages of owners instead of truncating at the first page", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          results: [{ id: "owner-1" }],
          paging: { next: { after: "cursor-1" } },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { results: [{ id: "owner-2" }] }),
      );

    const owners = await fetchHubSpotOwners("token");

    expect(owners).toEqual([{ id: "owner-1" }, { id: "owner-2" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallUrl = fetchMock.mock.calls[1]![0] as URL;
    expect(secondCallUrl.searchParams.get("after")).toBe("cursor-1");
  });

  it("gives up after exhausting retries and surfaces the last error", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: "down" }));

    const resultPromise = fetchHubSpotOwners("token");
    const assertion = expect(resultPromise).rejects.toThrow(
      /HubSpot owners fetch failed/,
    );

    await vi.runAllTimersAsync();
    await assertion;

    // 1 initial attempt + 3 retries = 4 total calls.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("fetchHubSpotDealsModifiedSince", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a Search API filter converting the ISO cursor to unix millis", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { results: [] }));

    await fetchHubSpotDealsModifiedSince("token", "2026-08-01T00:00:00.000Z");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/deals/search");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body as string) as {
      filterGroups: Array<{
        filters: Array<{
          propertyName: string;
          operator: string;
          value: string;
        }>;
      }>;
    };

    expect(body.filterGroups[0]?.filters[0]).toEqual({
      propertyName: "hs_lastmodifieddate",
      operator: "GT",
      value: String(new Date("2026-08-01T00:00:00.000Z").getTime()),
    });
  });

  it("passes the after cursor through for pagination", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        results: [],
        paging: { next: { after: "20" } },
      }),
    );

    const page = await fetchHubSpotDealsModifiedSince(
      "token",
      "2026-08-01T00:00:00.000Z",
      "10",
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { after?: string };

    expect(body.after).toBe("10");
    expect(page.nextAfter).toBe("20");
  });

  it("returns results and null nextAfter when there's no more paging", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        results: [
          {
            id: "1",
            properties: { dealname: "Acme deal" },
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-02T00:00:00.000Z",
          },
        ],
      }),
    );

    const page = await fetchHubSpotDealsModifiedSince(
      "token",
      "2026-08-01T00:00:00.000Z",
    );

    expect(page.results).toHaveLength(1);
    expect(page.nextAfter).toBeNull();
  });

  it("throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { message: "invalid filter" }),
    );

    await expect(
      fetchHubSpotDealsModifiedSince("token", "2026-08-01T00:00:00.000Z"),
    ).rejects.toThrow(/HubSpot deals search failed/);
  });
});

describe("revokeHubSpotRefreshToken", () => {
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

  it("sends a DELETE to the refresh-tokens endpoint with bearer auth", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const ok = await revokeHubSpotRefreshToken("access-1", "refresh-1");

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.hubapi.com/oauth/v1/refresh-tokens/refresh-1",
      expect.objectContaining({
        method: "DELETE",
        headers: { Authorization: "Bearer access-1" },
      }),
    );
  });

  it("returns false rather than throwing when revocation fails", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "not found" }), { status: 404 }),
    );

    const ok = await revokeHubSpotRefreshToken("access-1", "refresh-1");

    expect(ok).toBe(false);
  });
});
