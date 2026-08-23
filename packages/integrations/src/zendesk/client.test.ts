import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildZendeskAuthorizationUrl,
  exchangeZendeskAuthorizationCode,
  fetchZendeskTickets,
  generatePkcePair,
  isValidZendeskSubdomain,
  refreshZendeskAccessToken,
  revokeZendeskAccessToken,
  ZENDESK_SCOPES,
  type ZendeskOAuthConfig,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONFIG: ZendeskOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/zendesk/callback",
  subdomain: "acme",
};

describe("isValidZendeskSubdomain", () => {
  it("accepts a real DNS-label-shaped subdomain", () => {
    expect(isValidZendeskSubdomain("acme")).toBe(true);
    expect(isValidZendeskSubdomain("acme-robotics")).toBe(true);
    expect(isValidZendeskSubdomain("a1")).toBe(true);
  });

  it("rejects subdomains that could break out of the URL host", () => {
    expect(isValidZendeskSubdomain("")).toBe(false);
    expect(isValidZendeskSubdomain("acme.zendesk.com")).toBe(false);
    expect(isValidZendeskSubdomain("acme/evil")).toBe(false);
    expect(isValidZendeskSubdomain("-acme")).toBe(false);
    expect(isValidZendeskSubdomain("acme-")).toBe(false);
    expect(isValidZendeskSubdomain("acme evil")).toBe(false);
  });
});

describe("generatePkcePair", () => {
  it("derives a real S256 challenge from the verifier", () => {
    const { verifier, challenge } = generatePkcePair();

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(
      createHash("sha256").update(verifier).digest("base64url"),
    );
  });
});

describe("buildZendeskAuthorizationUrl", () => {
  it("builds a real subdomain-scoped authorize URL with client id, scope, redirect uri, state, response_type, and PKCE params", () => {
    const url = new URL(
      buildZendeskAuthorizationUrl(CONFIG, "nonce-123", "challenge-abc"),
    );

    expect(url.origin + url.pathname).toBe(
      "https://acme.zendesk.com/oauth/authorizations/new",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("scope")).toBe(ZENDESK_SCOPES.join(" "));
    expect(url.searchParams.get("state")).toBe("nonce-123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("uses a different account's own subdomain for its host", () => {
    const url = new URL(
      buildZendeskAuthorizationUrl(
        { ...CONFIG, subdomain: "other-co" },
        "nonce-456",
        "challenge-abc",
      ),
    );

    expect(url.origin).toBe("https://other-co.zendesk.com");
  });
});

describe("exchangeZendeskAuthorizationCode", () => {
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

  it("sends a JSON body (not form-urlencoded) with credentials and code_verifier in the body, to the subdomain-scoped token endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "zendesk-access",
        refresh_token: "zendesk-refresh",
        expires_in: 3600,
      }),
    );

    const result = await exchangeZendeskAuthorizationCode(
      CONFIG,
      "auth-code",
      "verifier-xyz",
    );

    expect(result).toEqual({
      accessToken: "zendesk-access",
      refreshToken: "zendesk-refresh",
      expiresIn: 3600,
    });

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe("https://acme.zendesk.com/oauth/tokens");
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(calledInit.body as string);
    expect(body).toEqual({
      grant_type: "authorization_code",
      code: "auth-code",
      client_id: "client-1",
      client_secret: "secret-1",
      redirect_uri: CONFIG.redirectUri,
      scope: ZENDESK_SCOPES.join(" "),
      code_verifier: "verifier-xyz",
    });
  });

  it("throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "invalid_grant" }),
    );

    await expect(
      exchangeZendeskAuthorizationCode(CONFIG, "bad-code", "verifier-xyz"),
    ).rejects.toThrow(/Zendesk token request failed/);
  });
});

describe("refreshZendeskAccessToken", () => {
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

  it("sends grant_type=refresh_token in the JSON body to the same subdomain-scoped endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "zendesk-new-access",
        refresh_token: "zendesk-rotated-refresh",
        expires_in: 3600,
      }),
    );

    const result = await refreshZendeskAccessToken(CONFIG, "zendesk-refresh");

    expect(result.accessToken).toBe("zendesk-new-access");
    expect(result.refreshToken).toBe("zendesk-rotated-refresh");
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://acme.zendesk.com/oauth/tokens");
    const body = JSON.parse(init.body as string);
    expect(body.grant_type).toBe("refresh_token");
    expect(body.refresh_token).toBe("zendesk-refresh");
  });
});

describe("revokeZendeskAccessToken", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("DELETEs the real current-token endpoint with the access token as Bearer auth", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const revoked = await revokeZendeskAccessToken("acme", "zendesk-access");

    expect(revoked).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://acme.zendesk.com/api/v2/oauth/tokens/current.json",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer zendesk-access",
        }),
      }),
    );
  });

  it("never throws — returns false on a failed request", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(
      revokeZendeskAccessToken("acme", "zendesk-access"),
    ).resolves.toBe(false);
  });
});

describe("fetchZendeskTickets", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses start_time (not cursor) on an initial call with side-loaded users", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        tickets: [
          {
            id: 101,
            subject: "Cannot log in",
            status: "open",
            priority: "high",
            assignee_id: 55,
            requester_id: 66,
            due_at: null,
            updated_at: "2026-08-18T13:56:00Z",
            created_at: "2026-08-17T10:00:00Z",
          },
        ],
        users: [{ id: 55, name: "Jamie Rivera" }],
        after_cursor: "cursor-abc",
        end_of_stream: false,
      }),
    );

    const page = await fetchZendeskTickets(
      "acme",
      "access-token",
      1755000000,
      null,
    );

    expect(page.tickets).toHaveLength(1);
    expect(page.users).toEqual([{ id: 55, name: "Jamie Rivera" }]);
    expect(page.afterCursor).toBe("cursor-abc");
    expect(page.endOfStream).toBe(false);

    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    const url = new URL(calledUrl);
    expect(url.origin + url.pathname).toBe(
      "https://acme.zendesk.com/api/v2/incremental/tickets/cursor.json",
    );
    expect(url.searchParams.get("start_time")).toBe("1755000000");
    expect(url.searchParams.get("cursor")).toBeNull();
    expect(url.searchParams.get("include")).toBe("users");
  });

  it("uses cursor (not start_time) once a prior cursor exists", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        tickets: [],
        users: [],
        after_cursor: "cursor-def",
        end_of_stream: true,
      }),
    );

    await fetchZendeskTickets("acme", "access-token", 0, "cursor-abc");

    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    const url = new URL(calledUrl);
    expect(url.searchParams.get("cursor")).toBe("cursor-abc");
    expect(url.searchParams.get("start_time")).toBeNull();
  });

  it("throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: "Couldn't authenticate you" }),
    );

    await expect(
      fetchZendeskTickets("acme", "bad-token", 0, null),
    ).rejects.toThrow(/Zendesk tickets fetch failed/);
  });
});
