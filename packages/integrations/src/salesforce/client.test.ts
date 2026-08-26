import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpstreamProviderError } from "../shared/upstream-error";
import {
  buildSalesforceAuthorizationUrl,
  exchangeSalesforceAuthorizationCode,
  fetchSalesforceOpportunities,
  fetchSalesforceOpportunitiesPage,
  refreshSalesforceAccessToken,
  revokeSalesforceRefreshToken,
  SalesforceSessionExpiredError,
  SALESFORCE_SCOPES,
  type SalesforceOAuthConfig,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONFIG: SalesforceOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/salesforce/callback",
};

describe("buildSalesforceAuthorizationUrl", () => {
  it("builds a real authorize URL with response_type, client id, redirect uri, scope, state, and PKCE challenge", () => {
    const url = new URL(
      buildSalesforceAuthorizationUrl(CONFIG, "nonce-123", "challenge-abc"),
    );

    expect(url.origin + url.pathname).toBe(
      "https://login.salesforce.com/services/oauth2/authorize",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("scope")).toBe(SALESFORCE_SCOPES.join(" "));
    expect(url.searchParams.get("state")).toBe("nonce-123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("exchangeSalesforceAuthorizationCode", () => {
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

  it("maps a successful token response into a SalesforceTokenResponse", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "00Dtest-access",
        refresh_token: "5Aeptest-refresh",
        instance_url: "https://mycompany.my.salesforce.com",
        id: "https://login.salesforce.com/id/00D.../005...",
        token_type: "Bearer",
        issued_at: "1700000000000",
        signature: "sig",
      }),
    );

    const result = await exchangeSalesforceAuthorizationCode(
      CONFIG,
      "auth-code",
      "verifier-abc",
    );

    expect(result).toEqual({
      accessToken: "00Dtest-access",
      refreshToken: "5Aeptest-refresh",
      instanceUrl: "https://mycompany.my.salesforce.com",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://login.salesforce.com/services/oauth2/token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends the PKCE code_verifier alongside the client_secret, additive not a replacement", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "00Dtest-access",
        refresh_token: "5Aeptest-refresh",
        instance_url: "https://mycompany.my.salesforce.com",
      }),
    );

    await exchangeSalesforceAuthorizationCode(
      CONFIG,
      "auth-code",
      "verifier-abc",
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = String(init.body);
    expect(body).toContain("code_verifier=verifier-abc");
    expect(body).toContain(`client_secret=${CONFIG.clientSecret}`);
  });

  it("captures Salesforce's error/error_description fields as diagnostic detail on a 400, without leaking them into the client-visible message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: "invalid_grant",
        error_description: "authentication failure",
      }),
    );

    let thrown: unknown;

    try {
      await exchangeSalesforceAuthorizationCode(
        CONFIG,
        "bad-code",
        "verifier-abc",
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(UpstreamProviderError);
    const error = thrown as UpstreamProviderError;
    expect(error.message).not.toContain("invalid_grant");
    expect(error.message).toContain("Salesforce token request failed");
    expect(error.rawDetail).toContain("invalid_grant");
    expect(error.rawDetail).toContain("authentication failure");
  });

  it("regression: does not retry on a 5xx — the authorization code is single-use, so a retry would resend an already-consumed code", async () => {
    // Real gap found by review: this used to retry on a 5xx/429 like any
    // other default call, reusing the shared default retry policy. But a
    // 5xx here is not proof Salesforce never consumed the code; if it
    // did, retrying resends the same now-dead code and Salesforce
    // correctly rejects it, permanently losing the one real token pair
    // that was already issued but never received. Fixed via
    // `{ retryable: false }` (see the source file's own doc comment on
    // requestSalesforceToken).
    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { error: "unavailable" }),
    );

    await expect(
      exchangeSalesforceAuthorizationCode(CONFIG, "auth-code", "verifier-abc"),
    ).rejects.toThrow(UpstreamProviderError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("refreshSalesforceAccessToken", () => {
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

  it("posts grant_type=refresh_token and maps the response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "00Dtest-new-access",
        refresh_token: "5Aeptest-refresh",
        instance_url: "https://mycompany.my.salesforce.com",
      }),
    );

    const result = await refreshSalesforceAccessToken(
      CONFIG,
      "5Aeptest-refresh",
    );

    expect(result.accessToken).toBe("00Dtest-new-access");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain("grant_type=refresh_token");
  });
});

describe("fetchSalesforceOpportunities", () => {
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

  it("builds a SOQL query hitting the real query resource with owner relationship fields", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        done: true,
        totalSize: 1,
        records: [
          {
            attributes: {
              type: "Opportunity",
              url: "/services/data/v67.0/sobjects/Opportunity/006x",
            },
            Id: "006x",
            Name: "Acme Deal",
            Amount: 5000,
            StageName: "Prospecting",
            CloseDate: "2026-09-01",
            Owner: { Id: "005x", Name: "Jamie Rivera" },
            CreatedDate: "2026-08-01T00:00:00.000+0000",
            LastModifiedDate: "2026-08-18T00:00:00.000+0000",
            IsClosed: false,
            IsWon: false,
          },
        ],
      }),
    );

    const page = await fetchSalesforceOpportunities(
      "https://mycompany.my.salesforce.com",
      "access-token",
    );

    expect(page.records).toHaveLength(1);
    expect(page.records[0]?.Owner).toEqual({
      Id: "005x",
      Name: "Jamie Rivera",
    });
    expect(page.nextRecordsUrl).toBeNull();

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toContain(
      "https://mycompany.my.salesforce.com/services/data/v67.0/query/",
    );
    expect(calledUrl).toContain("Owner.Name");
    expect((calledInit.headers as Record<string, string>).Authorization).toBe(
      "Bearer access-token",
    );
  });

  it("adds a LastModifiedDate WHERE clause, unquoted ISO-8601, when sinceIso is given", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { done: true, totalSize: 0, records: [] }),
    );

    await fetchSalesforceOpportunities(
      "https://mycompany.my.salesforce.com",
      "access-token",
      "2026-08-01T00:00:00.000Z",
    );

    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    // `URLSearchParams` encodes spaces as `+` (form-encoding convention),
    // which `decodeURIComponent` alone does not turn back into spaces.
    const decoded = decodeURIComponent(calledUrl).replace(/\+/g, " ");
    expect(decoded).toContain(
      "WHERE LastModifiedDate > 2026-08-01T00:00:00.000Z",
    );
  });

  it("surfaces nextRecordsUrl when Salesforce reports done: false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        done: false,
        totalSize: 5000,
        records: [],
        nextRecordsUrl: "/services/data/v67.0/query/01gXXX-2000",
      }),
    );

    const page = await fetchSalesforceOpportunities(
      "https://mycompany.my.salesforce.com",
      "access-token",
    );

    expect(page.nextRecordsUrl).toBe("/services/data/v67.0/query/01gXXX-2000");
  });

  it("throws SalesforceSessionExpiredError on a real INVALID_SESSION_ID response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, [
        {
          message: "Session expired or invalid",
          errorCode: "INVALID_SESSION_ID",
        },
      ]),
    );

    await expect(
      fetchSalesforceOpportunities(
        "https://mycompany.my.salesforce.com",
        "stale-token",
      ),
    ).rejects.toThrow(SalesforceSessionExpiredError);
  });

  it("throws a plain error, not SalesforceSessionExpiredError, for a 401 that isn't INVALID_SESSION_ID", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, [{ message: "Not authorized", errorCode: "OTHER" }]),
    );

    let caught: unknown;

    try {
      await fetchSalesforceOpportunities(
        "https://mycompany.my.salesforce.com",
        "bad-token",
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(SalesforceSessionExpiredError);
  });
});

describe("fetchSalesforceOpportunitiesPage", () => {
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

  it("GETs the exact nextRecordsUrl appended to the instance host, not a rebuilt query", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { done: true, totalSize: 0, records: [] }),
    );

    await fetchSalesforceOpportunitiesPage(
      "https://mycompany.my.salesforce.com",
      "access-token",
      "/services/data/v67.0/query/01gXXX-2000",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://mycompany.my.salesforce.com/services/data/v67.0/query/01gXXX-2000",
      expect.objectContaining({
        headers: { Authorization: "Bearer access-token" },
      }),
    );
  });
});

describe("revokeSalesforceRefreshToken", () => {
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

  it("posts to the org's own instance URL, not a fixed host", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const revoked = await revokeSalesforceRefreshToken(
      "https://mycompany.my.salesforce.com",
      "5Aeptest-refresh",
    );

    expect(revoked).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://mycompany.my.salesforce.com/services/oauth2/revoke",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns false rather than throwing on a transport failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const revoked = await revokeSalesforceRefreshToken(
      "https://mycompany.my.salesforce.com",
      "5Aeptest-refresh",
    );

    expect(revoked).toBe(false);
  });
});
