import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildQuickBooksAuthorizationUrl,
  exchangeQuickBooksAuthorizationCode,
  fetchQuickBooksInvoices,
  QUICKBOOKS_SCOPES,
  revokeQuickBooksToken,
  type QuickBooksOAuthConfig,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONFIG: QuickBooksOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/quickbooks/callback",
};

describe("buildQuickBooksAuthorizationUrl", () => {
  it("builds a real authorize URL with client id, response_type, scope, redirect uri, and state", () => {
    const url = new URL(buildQuickBooksAuthorizationUrl(CONFIG, "nonce-123"));

    expect(url.origin + url.pathname).toBe(
      "https://appcenter.intuit.com/connect/oauth2",
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("scope")).toBe(QUICKBOOKS_SCOPES.join(" "));
    expect(url.searchParams.get("state")).toBe("nonce-123");
  });
});

describe("exchangeQuickBooksAuthorizationCode", () => {
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

  it("maps a successful token response into a QuickBooksTokenResponse and sends Basic auth", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        token_type: "bearer",
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 3600,
        x_refresh_token_expires_in: 8_726_400,
      }),
    );

    const result = await exchangeQuickBooksAuthorizationCode(
      CONFIG,
      "auth-code",
    );

    expect(result).toEqual({
      accessToken: "at-1",
      refreshToken: "rt-1",
      expiresIn: 3600,
      refreshTokenExpiresIn: 8_726_400,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("client-1:secret-1").toString("base64")}`,
    );
  });

  it("throws on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "invalid_grant" }),
    );

    await expect(
      exchangeQuickBooksAuthorizationCode(CONFIG, "bad-code"),
    ).rejects.toThrow(/400/);
  });

  it("retries on a 5xx before succeeding, reusing the shared retry policy", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: "unavailable" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          token_type: "bearer",
          access_token: "at-retry",
          refresh_token: "rt-retry",
          expires_in: 3600,
          x_refresh_token_expires_in: 8_726_400,
        }),
      );

    const resultPromise = exchangeQuickBooksAuthorizationCode(
      CONFIG,
      "auth-code",
    );
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.accessToken).toBe("at-retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("revokeQuickBooksToken", () => {
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

  it("returns true on a 200 response and sends the token as a JSON body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    const revoked = await revokeQuickBooksToken(CONFIG, "rt-1");

    expect(revoked).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
    );
    expect(init.body).toBe(JSON.stringify({ token: "rt-1" }));
  });

  it("returns false rather than throwing on an error response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "invalid" }));

    const revokePromise = revokeQuickBooksToken(CONFIG, "rt-bad");
    await vi.runAllTimersAsync();

    expect(await revokePromise).toBe(false);
  });

  it("returns false rather than throwing on a transport failure", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    const revokePromise = revokeQuickBooksToken(CONFIG, "rt-1");
    await vi.runAllTimersAsync();

    expect(await revokePromise).toBe(false);
  });
});

describe("fetchQuickBooksInvoices", () => {
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

  it("queries open invoices for the given company with a bearer token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        QueryResponse: {
          Invoice: [
            {
              Id: "148",
              SyncToken: "3",
              TotalAmt: 2500,
              Balance: 2500,
              DueDate: "2026-08-01",
              CustomerRef: { value: "62", name: "Acme Robotics" },
            },
          ],
        },
      }),
    );

    const page = await fetchQuickBooksInvoices(
      "access-token-1",
      "realm-999",
      0,
    );

    expect(page.results).toHaveLength(1);
    expect(page.results[0]?.Id).toBe("148");
    expect(page.hasMore).toBe(false);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.origin + requestUrl.pathname).toBe(
      "https://quickbooks.api.intuit.com/v3/company/realm-999/query",
    );
    expect(requestUrl.searchParams.get("query")).toContain(
      "from Invoice where Balance > '0'",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer access-token-1",
    );
  });

  it("reports hasMore when a full page comes back", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({
      Id: String(index),
      SyncToken: "1",
      TotalAmt: 100,
      Balance: 100,
      DueDate: "2026-08-01",
      CustomerRef: { value: "1" },
    }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { QueryResponse: { Invoice: fullPage } }),
    );

    const page = await fetchQuickBooksInvoices("access-token-1", "realm-1", 0);

    expect(page.hasMore).toBe(true);
  });

  it("returns an empty page when QuickBooks reports no invoices", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { QueryResponse: {} }));

    const page = await fetchQuickBooksInvoices("access-token-1", "realm-1", 0);

    expect(page.results).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  it("throws on a non-ok response after retries are exhausted", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: "server_error" }));

    const resultPromise = fetchQuickBooksInvoices(
      "access-token-1",
      "realm-1",
      0,
    );
    const assertion = expect(resultPromise).rejects.toThrow(
      /QuickBooks invoice query failed/,
    );
    await vi.runAllTimersAsync();
    await assertion;
  });
});
