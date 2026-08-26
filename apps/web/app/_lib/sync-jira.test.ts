import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/jira");
vi.mock("./jira-config");

import { refreshJiraAccessToken } from "@signaldesk/integrations/jira";
import {
  getJiraTokens,
  storeJiraTokens,
  withAdvisoryLock,
  type DatabasePool,
} from "@signaldesk/persistence";

import { getJiraClientCredentials } from "./jira-config";
import { ensureFreshJiraAccessToken } from "./sync-jira";

const POOL = undefined as unknown as DatabasePool;

const mockedGetJiraTokens = vi.mocked(getJiraTokens);
const mockedStoreJiraTokens = vi.mocked(storeJiraTokens);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedRefreshJiraAccessToken = vi.mocked(refreshJiraAccessToken);
const mockedGetJiraClientCredentials = vi.mocked(getJiraClientCredentials);

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
 * refresh-store sequence every "Sync Now" depends on for a valid Jira
 * access token. Mirrors `sync-quickbooks.test.ts`'s structure exactly —
 * this connector was found by review to have the identical unlocked-race
 * gap QuickBooks was already fixed for, made worse here since Atlassian's
 * own docs (quoted in the source file) confirm the refresh token rotates
 * on every use.
 */
describe("ensureFreshJiraAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockedGetJiraClientCredentials.mockReturnValue({
      clientId: "client-1",
      clientSecret: "secret-1",
    });
    mockedWithAdvisoryLock.mockImplementation((_pool, _key, fn) => fn());
  });

  it("returns the stored access token unchanged when it isn't near expiry", async () => {
    mockedGetJiraTokens.mockResolvedValue(FRESH_TOKENS);

    const token = await ensureFreshJiraAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-fresh");
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
    expect(mockedRefreshJiraAccessToken).not.toHaveBeenCalled();
  });

  it("throws when no tokens are stored for this integration at all", async () => {
    mockedGetJiraTokens.mockResolvedValue(null);

    await expect(
      ensureFreshJiraAccessToken(POOL, "org-1", "integration-1"),
    ).rejects.toThrow("No stored Jira tokens for this integration.");
  });

  it("refreshes and persists a new token when the stored one is expiring soon", async () => {
    mockedGetJiraTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(EXPIRING_TOKENS);
    mockedRefreshJiraAccessToken.mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-new",
      expiresIn: 3600,
    });

    const token = await ensureFreshJiraAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-new");
    expect(mockedRefreshJiraAccessToken).toHaveBeenCalledWith(
      { clientId: "client-1", clientSecret: "secret-1" },
      "rt-old",
    );
    expect(mockedStoreJiraTokens).toHaveBeenCalledWith(
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
      "jira-token-refresh:integration-1",
      expect.any(Function),
    );
  });

  it("regression: does not refresh again when another caller already refreshed while this one waited for the lock", async () => {
    mockedGetJiraTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(FRESH_TOKENS);

    const token = await ensureFreshJiraAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-fresh");
    expect(mockedRefreshJiraAccessToken).not.toHaveBeenCalled();
    expect(mockedStoreJiraTokens).not.toHaveBeenCalled();
  });

  it("regression: real bug found by review — waits and retries instead of racing its own refresh call when the lock is already held by a concurrent refresh", async () => {
    // Real bug found by review: this function used to have no locking at
    // all. Two concurrent callers could both read the same near-expiry
    // token and both call refreshJiraAccessToken with it — since
    // Atlassian rotates the refresh token on every use, only one of those
    // two calls can actually succeed.
    mockedGetJiraTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS) // first attempt's outer read
      .mockResolvedValueOnce(FRESH_TOKENS); // second attempt's outer read, after the winner committed
    mockedWithAdvisoryLock.mockResolvedValueOnce(null); // lock held by the concurrent winner

    const tokenPromise = ensureFreshJiraAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );
    await vi.runAllTimersAsync();
    const token = await tokenPromise;

    expect(token).toBe("at-fresh");
    expect(mockedRefreshJiraAccessToken).not.toHaveBeenCalled();
    expect(mockedWithAdvisoryLock).toHaveBeenCalledTimes(1);
  });

  it("fails closed with a clear, honest error after exhausting its retries against a lock that never frees up", async () => {
    mockedGetJiraTokens.mockResolvedValue(EXPIRING_TOKENS);
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const resultPromise = ensureFreshJiraAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );
    const assertion = expect(resultPromise).rejects.toThrow(
      "another refresh for this connection was already in progress",
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(mockedRefreshJiraAccessToken).not.toHaveBeenCalled();
  });
});
