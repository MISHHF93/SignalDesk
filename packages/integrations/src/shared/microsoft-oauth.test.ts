import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildMicrosoftAuthorizationUrl,
  exchangeMicrosoftAuthorizationCode,
  generatePkcePair,
  MICROSOFT_IDENTITY_SCOPES,
  type MicrosoftOAuthConfig,
} from "./microsoft-oauth";

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

const CONFIG: MicrosoftOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/outlook/callback",
};

const READ_SCOPES = [
  ...MICROSOFT_IDENTITY_SCOPES,
  "https://graph.microsoft.com/Mail.Read",
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

describe("buildMicrosoftAuthorizationUrl", () => {
  it("builds a real authorize URL against the common tenant with PKCE params", () => {
    const url = new URL(
      buildMicrosoftAuthorizationUrl(
        CONFIG,
        READ_SCOPES,
        "nonce-123",
        "challenge-abc",
      ),
    );

    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("response_mode")).toBe("query");
    expect(url.searchParams.get("scope")).toBe(READ_SCOPES.join(" "));
    expect(url.searchParams.get("state")).toBe("nonce-123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("exchangeMicrosoftAuthorizationCode", () => {
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

  it("maps a successful response, decodes oid/email, and sends the code_verifier", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 3599,
        token_type: "Bearer",
        id_token: fakeIdToken({
          oid: "aaaa-bbbb-cccc",
          sub: "fallback-sub",
          email: "alex@example.test",
        }),
      }),
    );

    const result = await exchangeMicrosoftAuthorizationCode(
      CONFIG,
      READ_SCOPES,
      "auth-code",
      "verifier-xyz",
    );

    expect(result).toEqual({
      accessToken: "at-1",
      refreshToken: "rt-1",
      expiresIn: 3599,
      microsoftUserId: "aaaa-bbbb-cccc",
      email: "alex@example.test",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    );
    const body = init.body as URLSearchParams;
    expect(body.get("code_verifier")).toBe("verifier-xyz");
    expect(body.get("scope")).toBe(READ_SCOPES.join(" "));
  });

  it("falls back to the sub claim when oid is absent", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 3599,
        id_token: fakeIdToken({ sub: "consumer-sub-only" }),
      }),
    );

    const result = await exchangeMicrosoftAuthorizationCode(
      CONFIG,
      READ_SCOPES,
      "auth-code",
      "verifier-xyz",
    );

    expect(result.microsoftUserId).toBe("consumer-sub-only");
    expect(result.email).toBeNull();
  });

  it("throws when Microsoft omits the refresh_token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "at-1",
        expires_in: 3599,
        id_token: fakeIdToken({ sub: "s1" }),
      }),
    );

    await expect(
      exchangeMicrosoftAuthorizationCode(
        CONFIG,
        READ_SCOPES,
        "auth-code",
        "verifier",
      ),
    ).rejects.toThrow(/refresh_token/);
  });

  it("throws when Microsoft omits the id_token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 3599,
      }),
    );

    await expect(
      exchangeMicrosoftAuthorizationCode(
        CONFIG,
        READ_SCOPES,
        "auth-code",
        "verifier",
      ),
    ).rejects.toThrow(/id_token/);
  });

  it("retries on a 5xx before succeeding, reusing the shared retry policy", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: "unavailable" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: "at-retry",
          refresh_token: "rt-retry",
          expires_in: 3599,
          id_token: fakeIdToken({ oid: "retry-oid" }),
        }),
      );

    const resultPromise = exchangeMicrosoftAuthorizationCode(
      CONFIG,
      READ_SCOPES,
      "auth-code",
      "verifier",
    );
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.microsoftUserId).toBe("retry-oid");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
