import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpstreamProviderError } from "../shared/upstream-error";
import {
  buildStripeAuthorizationUrl,
  deauthorizeStripeAccount,
  exchangeStripeAuthorizationCode,
  STRIPE_SCOPE,
  type StripeOAuthConfig,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONFIG: StripeOAuthConfig = {
  clientId: "ca_test_client",
  secretKey: "sk_test_123",
  redirectUri: "https://example.test/integrations/stripe/callback",
};

describe("buildStripeAuthorizationUrl", () => {
  it("builds a real authorize URL with response_type, client id, read_only scope, redirect uri, and state", () => {
    const url = new URL(buildStripeAuthorizationUrl(CONFIG, "nonce-123"));

    expect(url.origin + url.pathname).toBe(
      "https://connect.stripe.com/oauth/authorize",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("ca_test_client");
    expect(url.searchParams.get("scope")).toBe(STRIPE_SCOPE);
    expect(url.searchParams.get("scope")).toBe("read_only");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("state")).toBe("nonce-123");
  });
});

describe("exchangeStripeAuthorizationCode", () => {
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

  it("maps a successful token response into a StripeConnectedAccount", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        token_type: "bearer",
        scope: "read_only",
        livemode: false,
        stripe_user_id: "acct_1Test123",
      }),
    );

    const result = await exchangeStripeAuthorizationCode(CONFIG, "ac_code");

    expect(result).toEqual({ stripeUserId: "acct_1Test123", livemode: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://connect.stripe.com/oauth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk_test_123",
        }),
      }),
    );
  });

  it("throws using Stripe's error/error_description body, even on a 200", async () => {
    // Per RFC 6749 §5.2 error responses are conventionally 4xx, but Stripe's
    // own docs don't guarantee that for every OAuth error path — check the
    // payload's own `error` field, not just HTTP status.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        error: "invalid_grant",
        error_description: "Authorization code does not exist",
      }),
    );

    let thrown: unknown;

    try {
      await exchangeStripeAuthorizationCode(CONFIG, "bad-code");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(UpstreamProviderError);
    const error = thrown as UpstreamProviderError;
    expect(error.message).not.toContain("invalid_grant");
    expect(error.message).toContain("Stripe token exchange failed");
    expect(error.rawDetail).toContain("invalid_grant");
    expect(error.rawDetail).toContain("Authorization code does not exist");
  });

  it("retries on a 5xx before succeeding, reusing the shared retry policy", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: "unavailable" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          token_type: "bearer",
          scope: "read_only",
          livemode: true,
          stripe_user_id: "acct_retry",
        }),
      );

    const resultPromise = exchangeStripeAuthorizationCode(CONFIG, "ac_code");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.stripeUserId).toBe("acct_retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("deauthorizeStripeAccount", () => {
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

  it("returns true when Stripe echoes back the same stripe_user_id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { stripe_user_id: "acct_1Test123" }),
    );

    const revoked = await deauthorizeStripeAccount(CONFIG, "acct_1Test123");

    expect(revoked).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://connect.stripe.com/oauth/deauthorize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk_test_123",
        }),
      }),
    );
  });

  it("returns false rather than throwing on an error response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "invalid_client" }));

    const revokePromise = deauthorizeStripeAccount(CONFIG, "acct_missing");
    await vi.runAllTimersAsync();

    expect(await revokePromise).toBe(false);
  });

  it("returns false rather than throwing on a transport failure", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    const revokePromise = deauthorizeStripeAccount(CONFIG, "acct_1Test123");
    await vi.runAllTimersAsync();

    expect(await revokePromise).toBe(false);
  });
});
