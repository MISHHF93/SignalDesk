import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  generatePkcePair,
  GOOGLE_IDENTITY_SCOPES,
  revokeGoogleToken,
  type GoogleOAuthConfig,
} from "./google-oauth";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeIdToken(claims: Record<string, unknown>): string {
  const base64url = (value: string) =>
    Buffer.from(value)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  return `${header}.${payload}.fake-signature`;
}

const CONFIG: GoogleOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/gmail/callback",
};

const READ_SCOPES = [
  ...GOOGLE_IDENTITY_SCOPES,
  "https://www.googleapis.com/auth/gmail.readonly",
];

describe("generatePkcePair", () => {
  it("derives a real S256 challenge from the verifier", () => {
    const { verifier, challenge } = generatePkcePair();

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(
      createHash("sha256").update(verifier).digest("base64url"),
    );
  });

  it("generates a different pair every call", () => {
    const first = generatePkcePair();
    const second = generatePkcePair();

    expect(first.verifier).not.toBe(second.verifier);
  });
});

describe("buildGoogleAuthorizationUrl", () => {
  it("builds a real authorize URL with client id, redirect uri, scopes, offline access, forced consent, state, and PKCE params", () => {
    const url = new URL(
      buildGoogleAuthorizationUrl(
        CONFIG,
        READ_SCOPES,
        "nonce-123",
        "challenge-abc",
      ),
    );

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(READ_SCOPES.join(" "));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("nonce-123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("exchangeGoogleAuthorizationCode", () => {
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

  it("maps a successful response, decodes the id_token's sub/email claims, and sends the code_verifier", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 3600,
        token_type: "Bearer",
        id_token: fakeIdToken({
          sub: "108293847562",
          email: "alex@example.test",
        }),
      }),
    );

    const result = await exchangeGoogleAuthorizationCode(
      CONFIG,
      "auth-code",
      "verifier-xyz",
    );

    expect(result).toEqual({
      accessToken: "at-1",
      refreshToken: "rt-1",
      expiresIn: 3600,
      googleUserId: "108293847562",
      email: "alex@example.test",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = init.body as URLSearchParams;
    expect(body.get("code_verifier")).toBe("verifier-xyz");
  });

  it("throws when Google omits the refresh_token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "at-1",
        expires_in: 3600,
        id_token: fakeIdToken({ sub: "108293847562" }),
      }),
    );

    await expect(
      exchangeGoogleAuthorizationCode(CONFIG, "auth-code", "verifier-xyz"),
    ).rejects.toThrow(/refresh_token/);
  });

  it("throws when Google omits the id_token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 3600,
      }),
    );

    await expect(
      exchangeGoogleAuthorizationCode(CONFIG, "auth-code", "verifier-xyz"),
    ).rejects.toThrow(/id_token/);
  });

  it("retries on a 5xx before succeeding, reusing the shared retry policy", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: "unavailable" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: "at-retry",
          refresh_token: "rt-retry",
          expires_in: 3600,
          id_token: fakeIdToken({ sub: "retry-sub" }),
        }),
      );

    const resultPromise = exchangeGoogleAuthorizationCode(
      CONFIG,
      "auth-code",
      "verifier-xyz",
    );
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.googleUserId).toBe("retry-sub");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("revokeGoogleToken", () => {
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

    const revoked = await revokeGoogleToken("rt-1");

    expect(revoked).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/revoke",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns false rather than throwing on an error response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "invalid" }));

    const revokePromise = revokeGoogleToken("rt-bad");
    await vi.runAllTimersAsync();

    expect(await revokePromise).toBe(false);
  });

  it("returns false rather than throwing on a transport failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const revoked = await revokeGoogleToken("rt-1");

    expect(revoked).toBe(false);
  });
});
