import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/asana");
vi.mock("./asana-config");

import { refreshAsanaAccessToken } from "@signaldesk/integrations/asana";
import {
  getAsanaTokens,
  storeAsanaTokens,
  withAdvisoryLock,
  type DatabasePool,
} from "@signaldesk/persistence";

import { getAsanaClientCredentials } from "./asana-config";
import { ensureFreshAsanaAccessToken } from "./sync-asana";

const POOL = undefined as unknown as DatabasePool;

const mockedGetAsanaTokens = vi.mocked(getAsanaTokens);
const mockedStoreAsanaTokens = vi.mocked(storeAsanaTokens);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedRefreshAsanaAccessToken = vi.mocked(refreshAsanaAccessToken);
const mockedGetAsanaClientCredentials = vi.mocked(getAsanaClientCredentials);

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
 * refresh-store sequence every "Sync Now" depends on for a valid Asana
 * access token. Mirrors `sync-xero.test.ts`'s structure exactly. Unlike
 * Xero/Zendesk (confirmed rotating providers), Asana's own docs never
 * state outright whether its refresh token rotates on use — the lock is
 * applied defensively here regardless (see `sync-asana.ts`'s doc comment),
 * so this coverage proves the same safe behavior without asserting a
 * rotation claim this codebase can't actually verify.
 */
describe("ensureFreshAsanaAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockedGetAsanaClientCredentials.mockReturnValue({
      clientId: "client-1",
      clientSecret: "secret-1",
    });
    mockedWithAdvisoryLock.mockImplementation((_pool, _key, fn) => fn());
  });

  it("returns the stored access token unchanged when it isn't near expiry", async () => {
    mockedGetAsanaTokens.mockResolvedValue(FRESH_TOKENS);

    const token = await ensureFreshAsanaAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-fresh");
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
    expect(mockedRefreshAsanaAccessToken).not.toHaveBeenCalled();
  });

  it("throws when no tokens are stored for this integration at all", async () => {
    mockedGetAsanaTokens.mockResolvedValue(null);

    await expect(
      ensureFreshAsanaAccessToken(POOL, "org-1", "integration-1"),
    ).rejects.toThrow("No stored Asana tokens for this integration.");
  });

  it("refreshes and persists a new token when the stored one is expiring soon", async () => {
    mockedGetAsanaTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(EXPIRING_TOKENS);
    mockedRefreshAsanaAccessToken.mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-new",
      expiresIn: 3600,
    });

    const token = await ensureFreshAsanaAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-new");
    expect(mockedRefreshAsanaAccessToken).toHaveBeenCalledWith(
      { clientId: "client-1", clientSecret: "secret-1" },
      "rt-old",
    );
    expect(mockedStoreAsanaTokens).toHaveBeenCalledWith(
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
      "asana-token-refresh:integration-1",
      expect.any(Function),
    );
  });

  it("regression: does not refresh again when another caller already refreshed while this one waited for the lock", async () => {
    mockedGetAsanaTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(FRESH_TOKENS);

    const token = await ensureFreshAsanaAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );

    expect(token).toBe("at-fresh");
    expect(mockedRefreshAsanaAccessToken).not.toHaveBeenCalled();
    expect(mockedStoreAsanaTokens).not.toHaveBeenCalled();
  });

  it("regression: waits and retries instead of racing its own refresh call when the lock is already held by a concurrent refresh", async () => {
    mockedGetAsanaTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS) // first attempt's outer read
      .mockResolvedValueOnce(FRESH_TOKENS); // second attempt's outer read, after the winner committed
    mockedWithAdvisoryLock.mockResolvedValueOnce(null); // lock held by the concurrent winner

    const tokenPromise = ensureFreshAsanaAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );
    await vi.runAllTimersAsync();
    const token = await tokenPromise;

    expect(token).toBe("at-fresh");
    expect(mockedRefreshAsanaAccessToken).not.toHaveBeenCalled();
    expect(mockedWithAdvisoryLock).toHaveBeenCalledTimes(1);
  });

  it("fails closed with a clear, honest error after exhausting its retries against a lock that never frees up", async () => {
    mockedGetAsanaTokens.mockResolvedValue(EXPIRING_TOKENS);
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const resultPromise = ensureFreshAsanaAccessToken(
      POOL,
      "org-1",
      "integration-1",
    );
    const assertion = expect(resultPromise).rejects.toThrow(
      "another refresh for this connection was already in progress",
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(mockedRefreshAsanaAccessToken).not.toHaveBeenCalled();
  });
});
