import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildXeroAuthorizationUrl,
  exchangeXeroAuthorizationCode,
  fetchXeroConnections,
  fetchXeroInvoices,
  fetchXeroPaidInvoices,
  refreshXeroAccessToken,
  revokeXeroRefreshToken,
  XERO_SCOPES,
  type XeroOAuthConfig,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONFIG: XeroOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/xero/callback",
};

describe("buildXeroAuthorizationUrl", () => {
  it("builds a real authorize URL with response_type, client id, redirect uri, scope, and state", () => {
    const url = new URL(buildXeroAuthorizationUrl(CONFIG, "nonce-123"));

    expect(url.origin + url.pathname).toBe(
      "https://login.xero.com/identity/connect/authorize",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("scope")).toBe(XERO_SCOPES.join(" "));
    expect(url.searchParams.get("state")).toBe("nonce-123");
  });
});

describe("exchangeXeroAuthorizationCode", () => {
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

  it("uses HTTP Basic auth and maps a successful token response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "xero-access",
        refresh_token: "xero-refresh",
        expires_in: 1800,
      }),
    );

    const result = await exchangeXeroAuthorizationCode(CONFIG, "auth-code");

    expect(result).toEqual({
      accessToken: "xero-access",
      refreshToken: "xero-refresh",
      expiresIn: 1800,
    });

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe("https://identity.xero.com/connect/token");
    const headers = calledInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("client-1:secret-1").toString("base64")}`,
    );
  });

  it("throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "invalid_grant" }),
    );

    await expect(
      exchangeXeroAuthorizationCode(CONFIG, "bad-code"),
    ).rejects.toThrow(/Xero token request failed/);
  });
});

describe("refreshXeroAccessToken", () => {
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

  it("posts grant_type=refresh_token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "xero-new-access",
        refresh_token: "xero-new-refresh",
        expires_in: 1800,
      }),
    );

    const result = await refreshXeroAccessToken(CONFIG, "xero-refresh");

    expect(result.accessToken).toBe("xero-new-access");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain("grant_type=refresh_token");
  });
});

describe("fetchXeroConnections", () => {
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

  it("GETs the real connections endpoint and maps the tenant list", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        {
          id: "conn-1",
          tenantId: "tenant-abc",
          tenantName: "Acme Robotics Ltd",
          tenantType: "ORGANISATION",
        },
      ]),
    );

    const connections = await fetchXeroConnections("access-token");

    expect(connections).toEqual([
      {
        tenantId: "tenant-abc",
        tenantName: "Acme Robotics Ltd",
        tenantType: "ORGANISATION",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.xero.com/connections",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });
});

describe("fetchXeroInvoices", () => {
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

  it("requests AUTHORISED sales invoices with the tenant header, no If-Modified-Since on an initial run", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        Invoices: [
          {
            InvoiceID: "inv-1",
            Type: "ACCREC",
            Contact: { ContactID: "contact-1", Name: "Acme Robotics" },
            Total: 1000,
            AmountDue: 500,
            DueDate: "/Date(1735689600000+0000)/",
            Status: "AUTHORISED",
            UpdatedDateUTC: "/Date(1735600000000+0000)/",
          },
        ],
      }),
    );

    const page = await fetchXeroInvoices("access-token", "tenant-abc", 1, null);

    expect(page.results).toHaveLength(1);
    expect(page.hasMore).toBe(false);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const decoded = decodeURIComponent(calledUrl).replace(/\+/g, " ");
    expect(decoded).toContain('Type=="ACCREC" AND Status=="AUTHORISED"');
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["Xero-tenant-id"]).toBe("tenant-abc");
    expect(headers["If-Modified-Since"]).toBeUndefined();
  });

  it("sends If-Modified-Since as an RFC 7231 HTTP-date when sinceIso is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { Invoices: [] }));

    await fetchXeroInvoices(
      "access-token",
      "tenant-abc",
      1,
      "2026-08-01T00:00:00.000Z",
    );

    const [, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["If-Modified-Since"]).toBe(
      new Date("2026-08-01T00:00:00.000Z").toUTCString(),
    );
  });

  it("treats a real 304 as zero results, not an error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));

    const page = await fetchXeroInvoices(
      "access-token",
      "tenant-abc",
      1,
      "2026-08-01T00:00:00.000Z",
    );

    expect(page).toEqual({ results: [], hasMore: false });
  });

  it("signals hasMore when a full page is returned", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({
      InvoiceID: `inv-${index}`,
      Type: "ACCREC" as const,
      Contact: { ContactID: "c1" },
      Total: 100,
      AmountDue: 100,
      DueDate: "/Date(1735689600000+0000)/",
      Status: "AUTHORISED",
      UpdatedDateUTC: "/Date(1735600000000+0000)/",
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { Invoices: fullPage }));

    const page = await fetchXeroInvoices("access-token", "tenant-abc", 1, null);

    expect(page.hasMore).toBe(true);
  });
});

describe("fetchXeroPaidInvoices", () => {
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

  it("requests PAID sales invoices with a required If-Modified-Since header", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { Invoices: [] }));

    await fetchXeroPaidInvoices(
      "access-token",
      "tenant-abc",
      1,
      "2026-08-01T00:00:00.000Z",
    );

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const decoded = decodeURIComponent(calledUrl).replace(/\+/g, " ");
    expect(decoded).toContain('Type=="ACCREC" AND Status=="PAID"');
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["If-Modified-Since"]).toBe(
      new Date("2026-08-01T00:00:00.000Z").toUTCString(),
    );
  });
});

describe("revokeXeroRefreshToken", () => {
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

  it("posts to the real revocation endpoint with Basic auth", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const revoked = await revokeXeroRefreshToken(CONFIG, "xero-refresh");

    expect(revoked).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identity.xero.com/connect/revocation",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns false rather than throwing on a transport failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const revoked = await revokeXeroRefreshToken(CONFIG, "xero-refresh");

    expect(revoked).toBe(false);
  });
});
