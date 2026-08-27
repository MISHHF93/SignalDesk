import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/hubspot");
vi.mock("./hubspot-config");

import {
  fetchHubSpotDealsModifiedSince,
  fetchHubSpotOwners,
  refreshHubSpotAccessToken,
} from "@signaldesk/integrations/hubspot";
import {
  getHubSpotTokens,
  listRecentSyncJobsForConnection,
  startSyncJob,
  storeHubSpotTokens,
  withAdvisoryLock,
  type DatabasePool,
  type SyncJob,
} from "@signaldesk/persistence";

import { getHubSpotOAuthConfig } from "./hubspot-config";
import {
  ensureFreshHubSpotAccessToken,
  syncHubSpotDeals,
} from "./sync-hubspot";

const POOL = undefined as unknown as DatabasePool;

const mockedGetHubSpotTokens = vi.mocked(getHubSpotTokens);
const mockedStoreHubSpotTokens = vi.mocked(storeHubSpotTokens);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedRefreshHubSpotAccessToken = vi.mocked(refreshHubSpotAccessToken);
const mockedGetHubSpotOAuthConfig = vi.mocked(getHubSpotOAuthConfig);
const mockedFetchHubSpotOwners = vi.mocked(fetchHubSpotOwners);
const mockedFetchHubSpotDealsModifiedSince = vi.mocked(
  fetchHubSpotDealsModifiedSince,
);
const mockedListRecentSyncJobsForConnection = vi.mocked(
  listRecentSyncJobsForConnection,
);
const mockedStartSyncJob = vi.mocked(startSyncJob);

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

const CONFIG = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://app.example.com/integrations/hubspot/callback",
};

/**
 * Real behavioral coverage for a function that had none: the read-check-
 * refresh-store sequence every "Sync Now" depends on for a valid HubSpot
 * access token. Mirrors `sync-xero.test.ts`'s structure exactly — HubSpot's
 * own developer documentation confirms a refresh call "potentially"
 * returns a new refresh token and explicitly recommends locking around
 * refreshes for that reason, the identical gap already closed for
 * QuickBooks/Xero/Jira/Zendesk.
 */
describe("ensureFreshHubSpotAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockedGetHubSpotOAuthConfig.mockReturnValue(CONFIG);
    mockedWithAdvisoryLock.mockImplementation((_pool, _key, fn) => fn());
  });

  it("returns the stored access token unchanged when it isn't near expiry", async () => {
    mockedGetHubSpotTokens.mockResolvedValue(FRESH_TOKENS);

    const token = await ensureFreshHubSpotAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "https://app.example.com",
    );

    expect(token).toBe("at-fresh");
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
    expect(mockedRefreshHubSpotAccessToken).not.toHaveBeenCalled();
  });

  it("throws when no tokens are stored for this integration at all", async () => {
    mockedGetHubSpotTokens.mockResolvedValue(null);

    await expect(
      ensureFreshHubSpotAccessToken(
        POOL,
        "org-1",
        "integration-1",
        "https://app.example.com",
      ),
    ).rejects.toThrow("No stored HubSpot tokens for this integration.");
  });

  it("refreshes and persists a new token when the stored one is expiring soon", async () => {
    mockedGetHubSpotTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(EXPIRING_TOKENS);
    mockedRefreshHubSpotAccessToken.mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-new",
      expiresIn: 1800,
      hubId: "hub-1",
    });

    const token = await ensureFreshHubSpotAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "https://app.example.com",
    );

    expect(token).toBe("at-new");
    expect(mockedRefreshHubSpotAccessToken).toHaveBeenCalledWith(
      CONFIG,
      "rt-old",
    );
    expect(mockedStoreHubSpotTokens).toHaveBeenCalledWith(
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
      "hubspot-token-refresh:integration-1",
      expect.any(Function),
    );
  });

  it("regression: does not refresh again when another caller already refreshed while this one waited for the lock", async () => {
    mockedGetHubSpotTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS)
      .mockResolvedValueOnce(FRESH_TOKENS);

    const token = await ensureFreshHubSpotAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "https://app.example.com",
    );

    expect(token).toBe("at-fresh");
    expect(mockedRefreshHubSpotAccessToken).not.toHaveBeenCalled();
    expect(mockedStoreHubSpotTokens).not.toHaveBeenCalled();
  });

  it("regression: real bug found by review — waits and retries instead of racing its own refresh call when the lock is already held by a concurrent refresh", async () => {
    mockedGetHubSpotTokens
      .mockResolvedValueOnce(EXPIRING_TOKENS) // first attempt's outer read
      .mockResolvedValueOnce(FRESH_TOKENS); // second attempt's outer read, after the winner committed
    mockedWithAdvisoryLock.mockResolvedValueOnce(null); // lock held by the concurrent winner

    const tokenPromise = ensureFreshHubSpotAccessToken(
      POOL,
      "org-1",
      "integration-1",
      "https://app.example.com",
    );
    await vi.runAllTimersAsync();
    const token = await tokenPromise;

    expect(token).toBe("at-fresh");
    expect(mockedRefreshHubSpotAccessToken).not.toHaveBeenCalled();
    expect(mockedWithAdvisoryLock).toHaveBeenCalledTimes(1);
  });

  it("fails closed with a clear, honest error after exhausting its retries against a lock that never frees up", async () => {
    mockedGetHubSpotTokens.mockResolvedValue(EXPIRING_TOKENS);
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const resultPromise = ensureFreshHubSpotAccessToken(
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

    expect(mockedRefreshHubSpotAccessToken).not.toHaveBeenCalled();
  });
});

function fakeSyncJob(overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    id: "job-1",
    organizationId: "org-1",
    integrationId: "integration-1",
    sourceSystem: "hubspot",
    entityType: "lead",
    trigger: "manual",
    status: "running",
    itemsIngested: 0,
    itemsSkipped: 0,
    cursorBefore: null,
    cursorAfter: null,
    errorMessage: null,
    startedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

/**
 * Real behavioral coverage for a function that had none: proves the
 * fix for a real bug found by review — the initial sync used to call the
 * plain `GET /crm/v3/objects/deals` list, which HubSpot's own API
 * reference confirms has no `sort` parameter, unlike the ascending-sorted
 * Search API call used for incremental syncs. A page-capped initial pull
 * through the unordered endpoint could silently and permanently drop
 * deals whose `hs_lastmodifieddate` was older than one processed earlier
 * in the same run. Both paths now go through the same sorted call.
 */
describe("syncHubSpotDeals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchHubSpotOwners.mockResolvedValue([]);
    mockedFetchHubSpotDealsModifiedSince.mockResolvedValue({
      results: [],
      nextAfter: null,
    });
    mockedStartSyncJob.mockResolvedValue(fakeSyncJob());
  });

  it("regression: anchors the initial sync (no prior cursor) at a beginning-of-time sentinel through the same sorted Search API call incremental syncs use", async () => {
    mockedListRecentSyncJobsForConnection.mockResolvedValue([]);

    await syncHubSpotDeals(
      POOL,
      "org-1",
      "integration-1",
      "at-1",
      24,
      "initial",
    );

    expect(mockedFetchHubSpotDealsModifiedSince).toHaveBeenCalledWith(
      "at-1",
      "1970-01-01T00:00:00.000Z",
      undefined,
    );
  });

  it("uses the real stored cursor for an incremental sync, through the same call", async () => {
    mockedListRecentSyncJobsForConnection.mockResolvedValue([
      fakeSyncJob({
        status: "succeeded",
        cursorAfter: "2026-08-01T00:00:00.000Z",
      }),
    ]);

    await syncHubSpotDeals(
      POOL,
      "org-1",
      "integration-1",
      "at-1",
      24,
      "manual",
    );

    expect(mockedFetchHubSpotDealsModifiedSince).toHaveBeenCalledWith(
      "at-1",
      "2026-08-01T00:00:00.000Z",
      undefined,
    );
  });
});
