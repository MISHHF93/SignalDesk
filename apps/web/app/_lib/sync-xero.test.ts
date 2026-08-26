import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/xero");
vi.mock("./xero-config");

import { refreshXeroAccessToken } from "@signaldesk/integrations/xero";
import {
  getXeroTokens,
  storeXeroTokens,
  withAdvisoryLock,
  type DatabasePool,
} from "@signaldesk/persistence";

import { getXeroClientCredentials } from "./xero-config";
import { ensureFreshXeroAccessToken } from "./sync-xero";

const POOL = undefined as unknown as DatabasePool;

const mockedGetXeroTokens = vi.mocked(getXeroTokens);
const mockedStoreXeroTokens = vi.mocked(storeXeroTokens);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedRefreshXeroAccessToken = vi.mocked(refreshXeroAccessToken);
const mockedGetXeroClientCredentials = vi.mocked(getXeroClientCredentials);

const FRESH_TOKENS = {
  accessToken: "at-fresh",
  refreshToken: "rt-fresh",
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
};

const EXPIRING_TOKENS = {
  accessToken: "at-old",
  refreshToken: "rt-old",
  expiresAt: new Date(Date.now() + 60 * 1000),
};

/**
 * Real behavioral coverage for a function that had none: the read-check-
 * refresh-store sequence every "Sync Now" depends on for a valid Xero
 * access token. Mirrors `sync-quickbooks.test.ts`'s structure exactly —
 * this connector was found by review to have the identical unlocked-race
 * gap QuickBooks was already fixed for.
 */
describe("ensureFreshXeroAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockedGetXeroClientCredentials.mockReturnValue({
      clientId: "client-1",
      clientSecret: "secret-1",
    });
    mockedWithAdvisoryLock.mockImplementation((_pool, _key, fn) => fn());
  });

  it("returns the stored access token unchanged when it isn't near expiry", async () => {
    mockedGetXeroTokens.mockResolvedValue(FRESH_TOKENS);

    const token = await ensureFreshXeroAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-fresh");
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
    expect(mockedRefreshXeroAccessToken).not.toHaveBeenCalled();
  });

  it("throws when no tokens are stored for this integration at all", async () => {
    mockedGetXeroTokens.mockResolvedValue(null);

    await expect(
      ensureFreshXeroAccessToken(POOL, "org-1", "integration-1"),
    ).rejects.toThrow("No stored Xero tokens for this integration.");
  });

  it("refreshes and persists a new token when the stored one is expiring soon", async () => {
    mockedGetXeroTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(EXPIRING_TOKENS);
    mockedRefreshXeroAccessToken.mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-new",
      expiresIn: 1800,
    });

    const token = await ensureFreshXeroAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-new");
    expect(mockedRefreshXeroAccessToken).toHaveBeenCalledWith(
      { clientId: "client-1", clientSecret: "secret-1" },
      "rt-old",
    );
    expect(mockedStoreXeroTokens).toHaveBeenCalledWith(
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
      "xero-token-refresh:integration-1",
      expect.any(Function),
    );
  });

  it("regression: does not refresh again when another caller already refreshed while this one waited for the lock", async () => {
    mockedGetXeroTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(FRESH_TOKENS);

    const token = await ensureFreshXeroAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-fresh");
    expect(mockedRefreshXeroAccessToken).not.toHaveBeenCalled();
    expect(mockedStoreXeroTokens).not.toHaveBeenCalled();
  });

  it("regression: real bug found by review — waits and retries instead of racing its own refresh call when the lock is already held by a concurrent refresh", async () => {
    // Real bug found by review: this function used to have no locking at
    // all. Two concurrent callers (a scheduled sync and a manual "Sync
    // Now") could both read the same near-expiry token and both call
    // refreshXeroAccessToken with it — since Xero rotates the refresh
    // token on every use, only one of those two calls can actually
    // succeed.
    mockedGetXeroTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS) // first attempt's outer read
      .mockResolvedValueOnce(FRESH_TOKENS); // second attempt's outer read, after the winner committed
    mockedWithAdvisoryLock.mockResolvedValueOnce(null); // lock held by the concurrent winner

    const tokenPromise = ensureFreshXeroAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );
    await vi.runAllTimersAsync();
    const token = await tokenPromise;

    expect(token).toBe("at-fresh");
    expect(mockedRefreshXeroAccessToken).not.toHaveBeenCalled();
    expect(mockedWithAdvisoryLock).toHaveBeenCalledTimes(1);
  });

  it("fails closed with a clear, honest error after exhausting its retries against a lock that never frees up", async () => {
    mockedGetXeroTokens.mockResolvedValue(EXPIRING_TOKENS);
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const resultPromise = ensureFreshXeroAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );
    const assertion = expect(resultPromise).rejects.toThrow(
      "another refresh for this connection was already in progress",
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(mockedRefreshXeroAccessToken).not.toHaveBeenCalled();
  });
});
