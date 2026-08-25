import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildJiraAuthorizationUrl,
  exchangeJiraAuthorizationCode,
  fetchJiraAccessibleResources,
  fetchJiraIssues,
  JIRA_SCOPES,
  refreshJiraAccessToken,
  type JiraOAuthConfig,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONFIG: JiraOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/jira/callback",
};

describe("buildJiraAuthorizationUrl", () => {
  it("builds a real authorize URL with audience, client id, scope, redirect uri, state, response_type, and prompt", () => {
    const url = new URL(buildJiraAuthorizationUrl(CONFIG, "nonce-123"));

    expect(url.origin + url.pathname).toBe(
      "https://auth.atlassian.com/authorize",
    );
    expect(url.searchParams.get("audience")).toBe("api.atlassian.com");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("scope")).toBe(JIRA_SCOPES.join(" "));
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("state")).toBe("nonce-123");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });
});

describe("exchangeJiraAuthorizationCode", () => {
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

  it("sends a JSON body, not form-urlencoded, and maps a successful response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "jira-access",
        refresh_token: "jira-refresh",
        expires_in: 3600,
      }),
    );

    const result = await exchangeJiraAuthorizationCode(CONFIG, "auth-code");

    expect(result).toEqual({
      accessToken: "jira-access",
      refreshToken: "jira-refresh",
      expiresIn: 3600,
    });

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe("https://auth.atlassian.com/oauth/token");
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(calledInit.body as string);
    expect(body).toEqual({
      grant_type: "authorization_code",
      client_id: "client-1",
      client_secret: "secret-1",
      code: "auth-code",
      redirect_uri: CONFIG.redirectUri,
    });
  });

  it("throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "invalid_grant" }),
    );

    await expect(
      exchangeJiraAuthorizationCode(CONFIG, "bad-code"),
    ).rejects.toThrow(/Jira token request failed/);
  });

  it("regression: does not retry on a 5xx — the authorization code is single-use, so a retry would resend an already-consumed code", async () => {
    // Real bug found by review: this used to retry on a 5xx via
    // fetchWithRetry's default policy — but a 5xx here isn't proof
    // Atlassian never consumed the code; if it did, retrying resends the
    // same now-dead code, which Atlassian correctly rejects, permanently
    // losing the one real token pair that was already issued but never
    // received. Fixed via `{ retryable: false }` on the shared
    // requestJiraToken helper.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { error: "unavailable" }),
    );

    await expect(
      exchangeJiraAuthorizationCode(CONFIG, "auth-code"),
    ).rejects.toThrow(/Jira token request failed/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("refreshJiraAccessToken", () => {
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

  it("sends grant_type=refresh_token in the JSON body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "jira-new-access",
        refresh_token: "jira-rotated-refresh",
        expires_in: 3600,
      }),
    );

    const result = await refreshJiraAccessToken(CONFIG, "jira-refresh");

    expect(result.accessToken).toBe("jira-new-access");
    expect(result.refreshToken).toBe("jira-rotated-refresh");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.grant_type).toBe("refresh_token");
    expect(body.refresh_token).toBe("jira-refresh");
  });

  it("regression: does not retry on a 5xx — Atlassian rotates the refresh token on every use, so a retry would resend an already-consumed one", async () => {
    // Real bug found by review: this used to retry on a 5xx via
    // fetchWithRetry's default policy. Atlassian rotates the refresh
    // token on every use (this file's own doc comment on
    // refreshJiraAccessToken), so a 5xx here is not proof the rotation
    // never happened server-side — a blind retry resends the
    // now-already-consumed refresh token, which Atlassian correctly
    // rejects, permanently losing the one real new refresh token that
    // was already issued but never received.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { error: "unavailable" }),
    );

    await expect(
      refreshJiraAccessToken(CONFIG, "jira-refresh"),
    ).rejects.toThrow(/Jira token request failed/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchJiraAccessibleResources", () => {
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

  it("GETs the real accessible-resources endpoint and maps the site list", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        {
          id: "cloud-abc",
          url: "https://acme.atlassian.net",
          name: "Acme Robotics",
          scopes: ["read:jira-work"],
          avatarUrl: "https://example.test/avatar.png",
        },
      ]),
    );

    const resources = await fetchJiraAccessibleResources("access-token");

    expect(resources).toEqual([
      {
        id: "cloud-abc",
        url: "https://acme.atlassian.net",
        name: "Acme Robotics",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.atlassian.com/oauth/token/accessible-resources",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });
});

describe("fetchJiraIssues", () => {
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

  it("queries the current search/jql endpoint with a statusCategory != Done JQL, no date clause on an initial run", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        issues: [
          {
            id: "10001",
            key: "ENG-1",
            fields: {
              summary: "Fix the thing",
              status: { name: "In Progress" },
              assignee: { displayName: "Jamie Rivera" },
              duedate: "2026-09-01",
              updated: "2026-08-18T13:56:00.000+0000",
            },
          },
        ],
        isLast: true,
      }),
    );

    const page = await fetchJiraIssues("access-token", "cloud-abc", null);

    expect(page.issues).toHaveLength(1);
    expect(page.nextPageToken).toBeNull();

    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    expect(calledUrl).toContain(
      "https://api.atlassian.com/ex/jira/cloud-abc/rest/api/3/search/jql",
    );
    const decoded = decodeURIComponent(calledUrl).replace(/\+/g, " ");
    expect(decoded).toContain("statusCategory != Done ORDER BY updated ASC");
    expect(decoded).not.toContain("AND updated >");
  });

  it("adds a quoted JQL date-literal clause (yyyy-MM-dd HH:mm, not ISO-8601) when sinceIso is given", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { issues: [], isLast: true }),
    );

    await fetchJiraIssues(
      "access-token",
      "cloud-abc",
      "2026-08-01T09:05:00.000Z",
    );

    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    const decoded = decodeURIComponent(calledUrl).replace(/\+/g, " ");
    expect(decoded).toContain('AND updated > "2026-08-01 09:05"');
  });

  it("passes nextPageToken through on a subsequent page request", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { issues: [], isLast: false, nextPageToken: "tok-2" }),
    );

    const page = await fetchJiraIssues(
      "access-token",
      "cloud-abc",
      null,
      "tok-1",
    );

    expect(page.nextPageToken).toBe("tok-2");
    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    expect(calledUrl).toContain("nextPageToken=tok-1");
  });

  it("throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { errorMessages: ["Unauthorized"] }),
    );

    await expect(
      fetchJiraIssues("bad-token", "cloud-abc", null),
    ).rejects.toThrow(/Jira issues fetch failed/);
  });
});
