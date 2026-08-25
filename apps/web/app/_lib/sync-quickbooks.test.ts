import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/quickbooks");
vi.mock("./quickbooks-config");

import { refreshQuickBooksAccessToken } from "@signaldesk/integrations/quickbooks";
import {
  getQuickBooksTokens,
  storeQuickBooksTokens,
  withAdvisoryLock,
  type DatabasePool,
} from "@signaldesk/persistence";

import { ensureFreshQuickBooksAccessToken } from "./sync-quickbooks";
import { getQuickBooksClientCredentials } from "./quickbooks-config";

const POOL = undefined as unknown as DatabasePool;

const mockedGetQuickBooksTokens = vi.mocked(getQuickBooksTokens);
const mockedStoreQuickBooksTokens = vi.mocked(storeQuickBooksTokens);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedRefreshQuickBooksAccessToken = vi.mocked(
  refreshQuickBooksAccessToken,
);
const mockedGetQuickBooksClientCredentials = vi.mocked(
  getQuickBooksClientCredentials,
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
 * refresh-store sequence every "Sync Now"/approve action depends on for a
 * valid QuickBooks access token.
 */
describe("ensureFreshQuickBooksAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockedGetQuickBooksClientCredentials.mockReturnValue({
      clientId: "client-1",
      clientSecret: "secret-1",
    });
    mockedWithAdvisoryLock.mockImplementation((_pool, _key, fn) => fn());
  });

  it("returns the stored access token unchanged when it isn't near expiry", async () => {
    mockedGetQuickBooksTokens.mockResolvedValue(FRESH_TOKENS);

    const token = await ensureFreshQuickBooksAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-fresh");
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
    expect(mockedRefreshQuickBooksAccessToken).not.toHaveBeenCalled();
  });

  it("throws when no tokens are stored for this integration at all", async () => {
    mockedGetQuickBooksTokens.mockResolvedValue(null);

    await expect(
      ensureFreshQuickBooksAccessToken(POOL, "org-1", "integration-1"),
    ).rejects.toThrow("No stored QuickBooks tokens for this integration.");
  });

  it("refreshes and persists a new token when the stored one is expiring soon", async () => {
    mockedGetQuickBooksTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(EXPIRING_TOKENS);
    mockedRefreshQuickBooksAccessToken.mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-new",
      expiresIn: 3600,
      refreshTokenExpiresIn: 8_726_400,
    });

    const token = await ensureFreshQuickBooksAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-new");
    expect(mockedRefreshQuickBooksAccessToken).toHaveBeenCalledWith(
      { clientId: "client-1", clientSecret: "secret-1" },
      "rt-old",
    );
    expect(mockedStoreQuickBooksTokens).toHaveBeenCalledWith(
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
      "quickbooks-token-refresh:integration-1",
      expect.any(Function),
    );
  });

  it("regression: does not refresh again when another caller already refreshed while this one waited for the lock", async () => {
    // The initial read (outside the lock) sees the expiring token; the
    // re-read inside the lock's callback sees the already-refreshed one
    // a concurrent caller committed in between — this call must reuse
    // that, not refresh a second time.
    mockedGetQuickBooksTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(FRESH_TOKENS);

    const token = await ensureFreshQuickBooksAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-fresh");
    expect(mockedRefreshQuickBooksAccessToken).not.toHaveBeenCalled();
    expect(mockedStoreQuickBooksTokens).not.toHaveBeenCalled();
  });

  it("regression: real bug found by review — waits and retries instead of racing its own refresh call when the lock is already held by a concurrent refresh", async () => {
    // Real bug found by review: this function used to have no locking at
    // all. Two concurrent callers could both read the same near-expiry
    // token and both call refreshQuickBooksAccessToken with it — since
    // QuickBooks rotates the refresh token on every use, only one of
    // those two calls can actually succeed.
    mockedGetQuickBooksTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS) // first attempt's outer read
      .mockResolvedValueOnce(FRESH_TOKENS); // second attempt's outer read, after the winner committed
    mockedWithAdvisoryLock.mockResolvedValueOnce(null); // lock held by the concurrent winner

    const tokenPromise = ensureFreshQuickBooksAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );
    await vi.runAllTimersAsync();
    const token = await tokenPromise;

    expect(token).toBe("at-fresh");
    expect(mockedRefreshQuickBooksAccessToken).not.toHaveBeenCalled();
    expect(mockedWithAdvisoryLock).toHaveBeenCalledTimes(1);
  });

  it("fails closed with a clear, honest error after exhausting its retries against a lock that never frees up", async () => {
    mockedGetQuickBooksTokens.mockResolvedValue(EXPIRING_TOKENS);
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const resultPromise = ensureFreshQuickBooksAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );
    const assertion = expect(resultPromise).rejects.toThrow(
      "another refresh for this connection was already in progress",
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(mockedRefreshQuickBooksAccessToken).not.toHaveBeenCalled();
  });
});
