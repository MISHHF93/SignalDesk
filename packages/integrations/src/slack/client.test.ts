import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSlackAuthorizationUrl,
  exchangeSlackAuthorizationCode,
  revokeSlackToken,
  SLACK_SCOPES,
  type SlackOAuthConfig,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONFIG: SlackOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/slack/callback",
};

describe("buildSlackAuthorizationUrl", () => {
  it("builds a real authorize URL with client id, redirect uri, scope, and state", () => {
    const url = new URL(buildSlackAuthorizationUrl(CONFIG, "nonce-123"));

    expect(url.origin + url.pathname).toBe(
      "https://slack.com/oauth/v2/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("scope")).toBe(SLACK_SCOPES.join(","));
    expect(url.searchParams.get("state")).toBe("nonce-123");
  });
});

describe("exchangeSlackAuthorizationCode", () => {
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

  it("maps a successful oauth.v2.access response into a SlackTokenResponse", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        access_token: "xoxb-test-token",
        bot_user_id: "U0KRQLJ9H",
        scope: "channels:read",
        team: { id: "T9TK3CUKW", name: "Test Workspace" },
      }),
    );

    const result = await exchangeSlackAuthorizationCode(CONFIG, "auth-code");

    expect(result).toEqual({
      accessToken: "xoxb-test-token",
      botUserId: "U0KRQLJ9H",
      scope: "channels:read",
      teamId: "T9TK3CUKW",
      teamName: "Test Workspace",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.com/api/oauth.v2.access",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws using Slack's `ok: false` + `error` signal, not just HTTP status", async () => {
    // Slack's Web API returns HTTP 200 even on failure — confirmed against
    // docs.slack.dev — so a naive `!response.ok` check would silently
    // treat this as success. Verifies the real failure signal is used.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: false, error: "invalid_code" }),
    );

    await expect(
      exchangeSlackAuthorizationCode(CONFIG, "bad-code"),
    ).rejects.toThrow(/invalid_code/);
  });

  it("retries on a 5xx before succeeding, reusing the shared retry policy", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(503, { ok: false, error: "unavailable" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          access_token: "xoxb-test-token",
          bot_user_id: "U1",
          scope: "channels:read",
          team: { id: "T1", name: "Retry Workspace" },
        }),
      );

    const resultPromise = exchangeSlackAuthorizationCode(CONFIG, "auth-code");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.teamId).toBe("T1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("revokeSlackToken", () => {
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

  it("returns true on a real { ok: true, revoked: true } response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: true, revoked: true }),
    );

    const revoked = await revokeSlackToken("xoxb-test-token");

    expect(revoked).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.com/api/auth.revoke",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer xoxb-test-token" },
      }),
    );
  });

  it("returns false rather than throwing when Slack reports ok: false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: false, error: "invalid_auth" }),
    );

    const revoked = await revokeSlackToken("xoxb-bad-token");

    expect(revoked).toBe(false);
  });

  it("returns false rather than throwing on a transport failure", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { ok: false }));

    const revokePromise = revokeSlackToken("xoxb-test-token");
    await vi.runAllTimersAsync();

    expect(await revokePromise).toBe(false);
  });
});
