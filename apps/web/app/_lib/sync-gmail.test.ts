import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/gmail");
vi.mock("./google-config");

import { refreshGmailAccessToken } from "@signaldesk/integrations/gmail";
import {
  getGmailTokens,
  storeGmailTokens,
  withAdvisoryLock,
  type DatabasePool,
} from "@signaldesk/persistence";

import { getGoogleOAuthConfig } from "./google-config";
import { ensureFreshGmailAccessToken } from "./sync-gmail";

const POOL = undefined as unknown as DatabasePool;

const mockedGetGmailTokens = vi.mocked(getGmailTokens);
const mockedStoreGmailTokens = vi.mocked(storeGmailTokens);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedRefreshGmailAccessToken = vi.mocked(refreshGmailAccessToken);
const mockedGetGoogleOAuthConfig = vi.mocked(getGoogleOAuthConfig);

const FRESH_TOKENS = {
  accessToken: "at-fresh",
  refreshToken: "rt-stable",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
};

const EXPIRING_TOKENS = {
  accessToken: "at-old",
  refreshToken: "rt-stable",
  expiresAt: new Date(Date.now() + 60 * 1000),
};

const CONFIG = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://app.example.com/integrations/gmail/callback",
};

/**
 * Real behavioral coverage for a function that had none: the read-check-
 * refresh-store sequence every "Sync Now" depends on for a valid Gmail
 * access token. Mirrors `sync-xero.test.ts`'s structure exactly — this
 * function's own doc comment claimed to "mirror `ensureFreshHubSpotAccessToken`
 * exactly" but had no locking at all before this fix. Google's refresh
 * token is confirmed non-rotating (unlike HubSpot/Zendesk), so the stored
 * `refreshToken` never changes across a refresh — these tests assert that
 * explicitly, since a regression reusing `refreshed.refreshToken` (a field
 * Google's API doesn't even return) would silently corrupt the stored
 * token.
 */
describe("ensureFreshGmailAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockedGetGoogleOAuthConfig.mockReturnValue(CONFIG);
    mockedWithAdvisoryLock.mockImplementation((_pool, _key, fn) => fn());
  });

  it("returns the stored access token unchanged when it isn't near expiry", async () => {
    mockedGetGmailTokens.mockResolvedValue(FRESH_TOKENS);

    const token = await ensureFreshGmailAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "https://app.example.com",
    );

    expect(token).toBe("at-fresh");
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
    expect(mockedRefreshGmailAccessToken).not.toHaveBeenCalled();
  });

  it("throws when no tokens are stored for this integration at all", async () => {
    mockedGetGmailTokens.mockResolvedValue(null);

    await expect(
      ensureFreshGmailAccessToken(
        POOL,
        "org-1",
        "integration-1",
        "https://app.example.com",
      ),
    ).rejects.toThrow("No stored Gmail tokens for this integration.");
  });

  it("refreshes and persists a new access token, keeping the stable refresh token unchanged", async () => {
    mockedGetGmailTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(EXPIRING_TOKENS);
    mockedRefreshGmailAccessToken.mockResolvedValue({
      accessToken: "at-new",
      expiresIn: 3600,
    });

    const token = await ensureFreshGmailAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "https://app.example.com",
    );

    expect(token).toBe("at-new");
    expect(mockedRefreshGmailAccessToken).toHaveBeenCalledWith(
      CONFIG,
      "rt-stable",
    );
    expect(mockedStoreGmailTokens).toHaveBeenCalledWith(
      POOL,
      "org-1",
      "integration-1",
      expect.objectContaining({
        accessToken: "at-new",
        refreshToken: "rt-stable",
      }),
    );
    expect(mockedWithAdvisoryLock).toHaveBeenCalledWith(
      undefined,
      "gmail-token-refresh:integration-1",
      expect.any(Function),
    );
  });

  it("regression: does not refresh again when another caller already refreshed while this one waited for the lock", async () => {
    mockedGetGmailTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(FRESH_TOKENS);

    const token = await ensureFreshGmailAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "https://app.example.com",
    );

    expect(token).toBe("at-fresh");
    expect(mockedRefreshGmailAccessToken).not.toHaveBeenCalled();
    expect(mockedStoreGmailTokens).not.toHaveBeenCalled();
  });

  it("regression: real gap found by review — waits and retries instead of racing its own refresh call when the lock is already held by a concurrent refresh", async () => {
    mockedGetGmailTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS) // first attempt's outer read
      .mockResolvedValueOnce(FRESH_TOKENS); // second attempt's outer read, after the winner committed
    mockedWithAdvisoryLock.mockResolvedValueOnce(null); // lock held by the concurrent winner

    const tokenPromise = ensureFreshGmailAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "https://app.example.com",
    );
    await vi.runAllTimersAsync();
    const token = await tokenPromise;

    expect(token).toBe("at-fresh");
    expect(mockedRefreshGmailAccessToken).not.toHaveBeenCalled();
    expect(mockedWithAdvisoryLock).toHaveBeenCalledTimes(1);
  });

  it("fails closed with a clear, honest error after exhausting its retries against a lock that never frees up", async () => {
    mockedGetGmailTokens.mockResolvedValue(EXPIRING_TOKENS);
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const resultPromise = ensureFreshGmailAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "https://app.example.com",
    );
    const assertion = expect(resultPromise).rejects.toThrow(
      "another refresh for this connection was already in progress",
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(mockedRefreshGmailAccessToken).not.toHaveBeenCalled();
  });
});
