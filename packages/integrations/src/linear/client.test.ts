import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildLinearAuthorizationUrl,
  exchangeLinearAuthorizationCode,
  fetchLinearViewer,
  LINEAR_SCOPES,
  revokeLinearToken,
  type LinearOAuthConfig,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONFIG: LinearOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/linear/callback",
};

describe("buildLinearAuthorizationUrl", () => {
  it("builds a real authorize URL with client id, read scope, user actor, redirect uri, and state", () => {
    const url = new URL(buildLinearAuthorizationUrl(CONFIG, "nonce-123"));

    expect(url.origin + url.pathname).toBe(
      "https://linear.app/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("scope")).toBe(LINEAR_SCOPES.join(" "));
    expect(url.searchParams.get("actor")).toBe("user");
    expect(url.searchParams.get("state")).toBe("nonce-123");
  });
});

describe("exchangeLinearAuthorizationCode", () => {
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

  it("maps a successful token response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 86399,
        token_type: "Bearer",
      }),
    );

    const result = await exchangeLinearAuthorizationCode(CONFIG, "auth-code");

    expect(result).toEqual({
      accessToken: "at-1",
      refreshToken: "rt-1",
      expiresIn: 86399,
    });
  });

  it("throws when Linear omits the refresh_token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { access_token: "at-1", expires_in: 86399 }),
    );

    await expect(
      exchangeLinearAuthorizationCode(CONFIG, "auth-code"),
    ).rejects.toThrow(/refresh_token/);
  });

  it("retries on a 5xx before succeeding, reusing the shared retry policy", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: "at-retry",
          refresh_token: "rt-retry",
          expires_in: 86399,
        }),
      );

    const resultPromise = exchangeLinearAuthorizationCode(CONFIG, "auth-code");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.accessToken).toBe("at-retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fetchLinearViewer", () => {
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

  it("queries the viewer field and returns id/email", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: { viewer: { id: "usr_123", email: "alex@example.test" } },
      }),
    );

    const viewer = await fetchLinearViewer("at-1");

    expect(viewer).toEqual({
      linearUserId: "usr_123",
      email: "alex@example.test",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.linear.app/graphql");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer at-1");
  });

  it("throws on a GraphQL errors array", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { errors: [{ message: "not authenticated" }] }),
    );

    await expect(fetchLinearViewer("bad-token")).rejects.toThrow(
      /not authenticated/,
    );
  });

  it("throws when the viewer id is missing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: {} }));

    await expect(fetchLinearViewer("at-1")).rejects.toThrow(/viewer id/);
  });
});

describe("revokeLinearToken", () => {
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

  it("returns true on a 200 response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    const revoked = await revokeLinearToken("rt-1");

    expect(revoked).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.linear.app/oauth/revoke");
    const body = init.body as URLSearchParams;
    expect(body.get("token")).toBe("rt-1");
    expect(body.get("token_type_hint")).toBe("refresh_token");
  });

  it("returns false rather than throwing on an error response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, {}));

    const revokePromise = revokeLinearToken("rt-bad");
    await vi.runAllTimersAsync();

    expect(await revokePromise).toBe(false);
  });

  it("returns false rather than throwing on a transport failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const revoked = await revokeLinearToken("rt-1");

    expect(revoked).toBe(false);
  });
});
