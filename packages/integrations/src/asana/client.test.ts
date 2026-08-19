import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ASANA_SCOPES,
  buildAsanaAuthorizationUrl,
  exchangeAsanaAuthorizationCode,
  fetchAsanaTasks,
  fetchAsanaWorkspaces,
  revokeAsanaToken,
  type AsanaOAuthConfig,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONFIG: AsanaOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/asana/callback",
};

describe("buildAsanaAuthorizationUrl", () => {
  it("builds a real authorize URL with client id, response_type, scope, redirect uri, and state", () => {
    const url = new URL(buildAsanaAuthorizationUrl(CONFIG, "nonce-123"));

    expect(url.origin + url.pathname).toBe(
      "https://app.asana.com/-/oauth_authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("scope")).toBe(ASANA_SCOPES.join(" "));
    expect(url.searchParams.get("state")).toBe("nonce-123");
  });
});

describe("exchangeAsanaAuthorizationCode", () => {
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

  it("maps a successful response, reading the user directly from data.gid/email", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 3600,
        token_type: "bearer",
        data: { gid: "12345", name: "Alex Rivera", email: "alex@example.test" },
      }),
    );

    const result = await exchangeAsanaAuthorizationCode(CONFIG, "auth-code");

    expect(result).toEqual({
      accessToken: "at-1",
      refreshToken: "rt-1",
      expiresIn: 3600,
      asanaUserId: "12345",
      email: "alex@example.test",
    });
  });

  it("throws when Asana omits data.gid", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 3600,
      }),
    );

    await expect(
      exchangeAsanaAuthorizationCode(CONFIG, "auth-code"),
    ).rejects.toThrow(/data\.gid/);
  });

  it("throws on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { errors: [{ message: "invalid_grant" }] }),
    );

    await expect(
      exchangeAsanaAuthorizationCode(CONFIG, "bad-code"),
    ).rejects.toThrow(/400/);
  });

  it("retries on a 5xx before succeeding, reusing the shared retry policy", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: "at-retry",
          refresh_token: "rt-retry",
          expires_in: 3600,
          data: { gid: "retry-gid" },
        }),
      );

    const resultPromise = exchangeAsanaAuthorizationCode(CONFIG, "auth-code");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.asanaUserId).toBe("retry-gid");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("revokeAsanaToken", () => {
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

  it("returns true on a 200 response and sends the refresh token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    const revoked = await revokeAsanaToken(CONFIG, "rt-1");

    expect(revoked).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://app.asana.com/-/oauth_revoke");
    const body = init.body as URLSearchParams;
    expect(body.get("token")).toBe("rt-1");
    expect(body.get("client_id")).toBe("client-1");
  });

  it("returns false rather than throwing on an error response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, {}));

    const revokePromise = revokeAsanaToken(CONFIG, "rt-bad");
    await vi.runAllTimersAsync();

    expect(await revokePromise).toBe(false);
  });

  it("returns false rather than throwing on a transport failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const revoked = await revokeAsanaToken(CONFIG, "rt-1");

    expect(revoked).toBe(false);
  });
});

describe("fetchAsanaWorkspaces", () => {
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

  it("lists the connected user's workspaces with a bearer token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: [{ gid: "1", name: "Acme Robotics" }],
      }),
    );

    const workspaces = await fetchAsanaWorkspaces("access-token-1");

    expect(workspaces).toEqual([{ gid: "1", name: "Acme Robotics" }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://app.asana.com/api/1.0/workspaces");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer access-token-1",
    );
  });

  it("throws on a non-ok response after retries are exhausted", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { errors: [] }));

    const resultPromise = fetchAsanaWorkspaces("access-token-1");
    const assertion = expect(resultPromise).rejects.toThrow(
      /Asana workspaces request failed/,
    );
    await vi.runAllTimersAsync();
    await assertion;
  });
});

describe("fetchAsanaTasks", () => {
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

  it("queries tasks by assignee and workspace with a bearer token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: [
          {
            gid: "148",
            name: "Ship Q3 report",
            completed: false,
            due_on: "2026-08-01",
            due_at: null,
            modified_at: "2026-08-17T11:55:00.000Z",
            assignee: { gid: "62", name: "Jordan Lee" },
          },
        ],
      }),
    );

    const page = await fetchAsanaTasks(
      "access-token-1",
      "assignee-62",
      "workspace-1",
    );

    expect(page.results).toHaveLength(1);
    expect(page.results[0]?.gid).toBe("148");
    expect(page.nextOffset).toBeNull();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.origin + requestUrl.pathname).toBe(
      "https://app.asana.com/api/1.0/tasks",
    );
    expect(requestUrl.searchParams.get("assignee")).toBe("assignee-62");
    expect(requestUrl.searchParams.get("workspace")).toBe("workspace-1");
    expect(requestUrl.searchParams.get("completed_since")).toBe("now");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer access-token-1",
    );
  });

  it("carries the next_page offset through for pagination", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: [],
        next_page: { offset: "cursor-abc" },
      }),
    );

    const page = await fetchAsanaTasks(
      "access-token-1",
      "assignee-62",
      "workspace-1",
    );

    expect(page.nextOffset).toBe("cursor-abc");
  });

  it("sends the provided offset as a query parameter", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await fetchAsanaTasks(
      "access-token-1",
      "assignee-62",
      "workspace-1",
      "cursor-abc",
    );

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.get("offset")).toBe("cursor-abc");
  });

  it("throws on a non-ok response after retries are exhausted", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { errors: [] }));

    const resultPromise = fetchAsanaTasks(
      "access-token-1",
      "assignee-62",
      "workspace-1",
    );
    const assertion = expect(resultPromise).rejects.toThrow(
      /Asana tasks request failed/,
    );
    await vi.runAllTimersAsync();
    await assertion;
  });
});
