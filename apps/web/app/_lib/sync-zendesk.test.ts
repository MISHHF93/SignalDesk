import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/zendesk");
vi.mock("./zendesk-config");

import { refreshZendeskAccessToken } from "@signaldesk/integrations/zendesk";
import {
  getZendeskTokens,
  storeZendeskTokens,
  withAdvisoryLock,
  type DatabasePool,
} from "@signaldesk/persistence";

import { getZendeskClientCredentials } from "./zendesk-config";
import { ensureFreshZendeskAccessToken } from "./sync-zendesk";

const POOL = undefined as unknown as DatabasePool;

const mockedGetZendeskTokens = vi.mocked(getZendeskTokens);
const mockedStoreZendeskTokens = vi.mocked(storeZendeskTokens);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedRefreshZendeskAccessToken = vi.mocked(refreshZendeskAccessToken);
const mockedGetZendeskClientCredentials = vi.mocked(
  getZendeskClientCredentials,
);

const FRESH_TOKENS = {
  accessToken: "at-fresh",
  refreshToken: "rt-fresh",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
};

const EXPIRING_TOKENS = {
  accessToken: "at-old",
  refreshToken: "rt-old",
  expiresAt: new Date(Date.now() + 60 * 1000),
};

/**
 * Real behavioral coverage for a function that had none: the read-check-
 * refresh-store sequence every "Sync Now" depends on for a valid Zendesk
 * access token. Mirrors `sync-xero.test.ts`'s structure exactly — this
 * connector's own `client.ts` explicitly documents that Zendesk rotates
 * the refresh token on every use, yet this function had no locking at all
 * before this fix, the identical gap already closed for
 * QuickBooks/Xero/Jira.
 */
describe("ensureFreshZendeskAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockedGetZendeskClientCredentials.mockReturnValue({
      clientId: "client-1",
      clientSecret: "secret-1",
    });
    mockedWithAdvisoryLock.mockImplementation((_pool, _key, fn) => fn());
  });

  it("returns the stored access token unchanged when it isn't near expiry", async () => {
    mockedGetZendeskTokens.mockResolvedValue(FRESH_TOKENS);

    const token = await ensureFreshZendeskAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "acme",
    );

    expect(token).toBe("at-fresh");
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
    expect(mockedRefreshZendeskAccessToken).not.toHaveBeenCalled();
  });

  it("throws when no tokens are stored for this integration at all", async () => {
    mockedGetZendeskTokens.mockResolvedValue(null);

    await expect(
      ensureFreshZendeskAccessToken(POOL, "org-1", "integration-1", "acme"),
    ).rejects.toThrow("No stored Zendesk tokens for this integration.");
  });

  it("refreshes and persists a new token when the stored one is expiring soon", async () => {
    mockedGetZendeskTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(EXPIRING_TOKENS);
    mockedRefreshZendeskAccessToken.mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-new",
      expiresIn: 3600,
    });

    const token = await ensureFreshZendeskAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "acme",
    );

    expect(token).toBe("at-new");
    expect(mockedRefreshZendeskAccessToken).toHaveBeenCalledWith(
      { clientId: "client-1", clientSecret: "secret-1", subdomain: "acme" },
      "rt-old",
    );
    expect(mockedStoreZendeskTokens).toHaveBeenCalledWith(
      POOL,
      "org-1",
      "integration-1",
      expect.objectContaining({
        accessToken: "at-new",
        refreshToken: "rt-new",
      }),
    );
    expect(mockedWithAdvisoryLock).toHaveBeenCalledWith(
      undefined,
      "zendesk-token-refresh:integration-1",
      expect.any(Function),
    );
  });

  it("regression: does not refresh again when another caller already refreshed while this one waited for the lock", async () => {
    mockedGetZendeskTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(FRESH_TOKENS);

    const token = await ensureFreshZendeskAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "acme",
    );

    expect(token).toBe("at-fresh");
    expect(mockedRefreshZendeskAccessToken).not.toHaveBeenCalled();
    expect(mockedStoreZendeskTokens).not.toHaveBeenCalled();
  });

  it("regression: real bug found by review — waits and retries instead of racing its own refresh call when the lock is already held by a concurrent refresh", async () => {
    mockedGetZendeskTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS) // first attempt's outer read
      .mockResolvedValueOnce(FRESH_TOKENS); // second attempt's outer read, after the winner committed
    mockedWithAdvisoryLock.mockResolvedValueOnce(null); // lock held by the concurrent winner

    const tokenPromise = ensureFreshZendeskAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "acme",
    );
    await vi.runAllTimersAsync();
    const token = await tokenPromise;

    expect(token).toBe("at-fresh");
    expect(mockedRefreshZendeskAccessToken).not.toHaveBeenCalled();
    expect(mockedWithAdvisoryLock).toHaveBeenCalledTimes(1);
  });

  it("fails closed with a clear, honest error after exhausting its retries against a lock that never frees up", async () => {
    mockedGetZendeskTokens.mockResolvedValue(EXPIRING_TOKENS);
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const resultPromise = ensureFreshZendeskAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "acme",
    );
    const assertion = expect(resultPromise).rejects.toThrow(
      "another refresh for this connection was already in progress",
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(mockedRefreshZendeskAccessToken).not.toHaveBeenCalled();
  });
});
