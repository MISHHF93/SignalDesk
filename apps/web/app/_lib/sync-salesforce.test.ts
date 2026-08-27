import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/salesforce");
vi.mock("./salesforce-config");

import { refreshSalesforceAccessToken } from "@signaldesk/integrations/salesforce";
import {
  getSalesforceTokens,
  storeSalesforceTokens,
  withAdvisoryLock,
  type DatabasePool,
} from "@signaldesk/persistence";

import { getSalesforceOAuthConfig } from "./salesforce-config";
import { refreshAndPersistSalesforceToken } from "./sync-salesforce";

const POOL = undefined as unknown as DatabasePool;
const ORIGIN = "https://app.example.com";

const mockedGetSalesforceTokens = vi.mocked(getSalesforceTokens);
const mockedStoreSalesforceTokens = vi.mocked(storeSalesforceTokens);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedRefreshSalesforceAccessToken = vi.mocked(
  refreshSalesforceAccessToken,
);
const mockedGetSalesforceOAuthConfig = vi.mocked(getSalesforceOAuthConfig);

const STALE_TOKENS = {
  accessToken: "at-stale",
  refreshToken: "rt-stable",
};

const FRESH_TOKENS = {
  accessToken: "at-fresh",
  refreshToken: "rt-stable",
};

/**
 * Real behavioral coverage for a function that had none: the refresh-and-
 * store sequence `fetchPageWithSessionRecovery` falls back to after a real
 * `SalesforceSessionExpiredError`. Mirrors `sync-xero.test.ts`'s structure
 * — this connector was found by review to have the identical unlocked-
 * race gap already fixed for every other real-sync connector — but the
 * "is this still fresh" re-check differs from every expiresAt-based
 * sibling: Salesforce discloses no token lifetime and doesn't rotate its
 * refresh token, so the signal used here is whether the stored access
 * token still matches the one that just failed, not an expiry comparison.
 */
describe("refreshAndPersistSalesforceToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockedGetSalesforceOAuthConfig.mockReturnValue({
      clientId: "client-1",
      clientSecret: "secret-1",
      redirectUri: "https://app.example.com/integrations/salesforce/callback",
    });
    mockedWithAdvisoryLock.mockImplementation((_pool, _key, fn) => fn());
  });

  it("refreshes and persists a new token when the stored one still matches the one that just failed", async () => {
    mockedGetSalesforceTokens.mockResolvedValue(STALE_TOKENS);
    mockedRefreshSalesforceAccessToken.mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-stable",
      instanceUrl: "https://example.my.salesforce.com",
    });

    const token = await refreshAndPersistSalesforceToken(
      POOL,
      "org-1",
      "integration-1",
      ORIGIN,
      "at-stale",
      "rt-stable",
    );

    expect(token).toBe("at-new");
    expect(mockedRefreshSalesforceAccessToken).toHaveBeenCalledWith(
      {
        clientId: "client-1",
        clientSecret: "secret-1",
        redirectUri: "https://app.example.com/integrations/salesforce/callback",
      },
      "rt-stable",
    );
    expect(mockedStoreSalesforceTokens).toHaveBeenCalledWith(
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
      "salesforce-token-refresh:integration-1",
      expect.any(Function),
    );
  });

  it("regression: does not refresh again when another caller already refreshed while this one waited for the lock", async () => {
    mockedGetSalesforceTokens.mockResolvedValue(FRESH_TOKENS);

    const token = await refreshAndPersistSalesforceToken(
      POOL,
      "org-1",
      "integration-1",
      ORIGIN,
      "at-stale",
      "rt-stable",
    );

    expect(token).toBe("at-fresh");
    expect(mockedRefreshSalesforceAccessToken).not.toHaveBeenCalled();
    expect(mockedStoreSalesforceTokens).not.toHaveBeenCalled();
  });

  it("regression: real bug found by review — waits and retries instead of racing its own refresh call when the lock is already held by a concurrent refresh", async () => {
    // Real bug found by review: this function used to have no locking at
    // all. Two concurrent callers (a scheduled sync and a manual "Sync
    // Now") could both catch a SalesforceSessionExpiredError for the same
    // stale token and both call refreshSalesforceAccessToken with it,
    // racing storeSalesforceTokens's unconditional overwrite.
    mockedGetSalesforceTokens.mockResolvedValueOnce(FRESH_TOKENS); // second attempt's re-read, after the winner committed
    mockedWithAdvisoryLock.mockResolvedValueOnce(null); // lock held by the concurrent winner

    const tokenPromise = refreshAndPersistSalesforceToken(
      POOL,
      "org-1",
      "integration-1",
      ORIGIN,
      "at-stale",
      "rt-stable",
    );
    await vi.runAllTimersAsync();
    const token = await tokenPromise;

    expect(token).toBe("at-fresh");
    expect(mockedRefreshSalesforceAccessToken).not.toHaveBeenCalled();
    expect(mockedWithAdvisoryLock).toHaveBeenCalledTimes(2);
  });

  it("fails closed with a clear, honest error after exhausting its retries against a lock that never frees up", async () => {
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const resultPromise = refreshAndPersistSalesforceToken(
      POOL,
      "org-1",
      "integration-1",
      ORIGIN,
      "at-stale",
      "rt-stable",
    );
    const assertion = expect(resultPromise).rejects.toThrow(
      "another refresh for this connection was already in progress",
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(mockedRefreshSalesforceAccessToken).not.toHaveBeenCalled();
  });
});
