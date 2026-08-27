import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/asana");
vi.mock("./asana-config");

import {
  fetchAsanaTasks,
  fetchAsanaWorkspaces,
  mapAsanaTaskToSourceTaskRecord,
  refreshAsanaAccessToken,
} from "@signaldesk/integrations/asana";
import {
  completeSyncJob,
  getAsanaTokens,
  listRecentSyncJobsForConnection,
  startSyncJob,
  storeAsanaTokens,
  withAdvisoryLock,
  type DatabasePool,
  type SyncJob,
} from "@signaldesk/persistence";

import { getAsanaClientCredentials } from "./asana-config";
import { ensureFreshAsanaAccessToken, syncAsanaTasks } from "./sync-asana";

const POOL = undefined as unknown as DatabasePool;

const mockedGetAsanaTokens = vi.mocked(getAsanaTokens);
const mockedStoreAsanaTokens = vi.mocked(storeAsanaTokens);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedRefreshAsanaAccessToken = vi.mocked(refreshAsanaAccessToken);
const mockedGetAsanaClientCredentials = vi.mocked(getAsanaClientCredentials);
const mockedFetchAsanaWorkspaces = vi.mocked(fetchAsanaWorkspaces);
const mockedFetchAsanaTasks = vi.mocked(fetchAsanaTasks);
const mockedMapAsanaTaskToSourceTaskRecord = vi.mocked(
  mapAsanaTaskToSourceTaskRecord,
);
const mockedListRecentSyncJobsForConnection = vi.mocked(
  listRecentSyncJobsForConnection,
);
const mockedCompleteSyncJob = vi.mocked(completeSyncJob);
const mockedStartSyncJob = vi.mocked(startSyncJob);

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

function fakeSyncJob(overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    id: "job-1",
    organizationId: "org-1",
    integrationId: "integration-1",
    sourceSystem: "asana",
    entityType: "task",
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

function fakeTaskPage(modifiedAt: string, nextOffset: string | null) {
  return {
    results: [
      {
        gid: `task-${modifiedAt}`,
        name: "A task",
        completed: false,
        due_on: null,
        due_at: null,
        modified_at: modifiedAt,
        assignee: null,
      },
    ],
    nextOffset,
  };
}

/**
 * Real behavioral coverage for a function that had none: proves the fix
 * for a real bug found by review — unlike HubSpot's incremental fetch,
 * Asana's `GET /tasks` has no ordering guarantee at all, so advancing the
 * cursor to the maximum `modified_at` seen in a page-capped run could
 * permanently skip an unprocessed, older task with no signal. A truncated
 * run must leave the cursor unchanged instead.
 */
describe("syncAsanaTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchAsanaWorkspaces.mockResolvedValue([
      { gid: "workspace-1", name: "Workspace" },
    ]);
    mockedStartSyncJob.mockResolvedValue(fakeSyncJob());
    // Every fake task below has no due_on/due_at, matching the real
    // "not ingested, not a failure" no-op path — this test only cares
    // about the cursor-truncation logic, not the ingestion pipeline.
    mockedMapAsanaTaskToSourceTaskRecord.mockReturnValue(null);
  });

  it("regression: does not advance the cursor when a workspace's fetch hits the page cap with more data remaining", async () => {
    mockedListRecentSyncJobsForConnection.mockResolvedValue([
      fakeSyncJob({
        status: "succeeded",
        cursorAfter: "2026-08-01T00:00:00.000Z",
      }),
    ]);
    // Every page still has a truthy nextOffset, including the last
    // allowed one — the loop only stops because it hits the page cap,
    // not because Asana ran out of data.
    mockedFetchAsanaTasks.mockImplementation(async (_at, _uid, _wgid, offset) =>
      fakeTaskPage(
        `2026-08-${20 + Number(offset ?? 0)}T00:00:00.000Z`,
        `next-${Number(offset ?? 0) + 1}`,
      ),
    );

    await syncAsanaTasks(
      POOL,
      "org-1",
      "integration-1",
      "at-1",
      "user-1",
      "manual",
    );

    expect(mockedFetchAsanaTasks).toHaveBeenCalledTimes(20);
    expect(mockedCompleteSyncJob).toHaveBeenCalledWith(
      POOL,
      "org-1",
      "job-1",
      expect.objectContaining({ cursorAfter: "2026-08-01T00:00:00.000Z" }),
    );
  });

  it("advances the cursor normally when every workspace completes within the page cap", async () => {
    mockedListRecentSyncJobsForConnection.mockResolvedValue([
      fakeSyncJob({
        status: "succeeded",
        cursorAfter: "2026-08-01T00:00:00.000Z",
      }),
    ]);
    mockedFetchAsanaTasks.mockResolvedValueOnce(
      fakeTaskPage("2026-08-15T00:00:00.000Z", null),
    );

    await syncAsanaTasks(
      POOL,
      "org-1",
      "integration-1",
      "at-1",
      "user-1",
      "manual",
    );

    expect(mockedFetchAsanaTasks).toHaveBeenCalledTimes(1);
    expect(mockedCompleteSyncJob).toHaveBeenCalledWith(
      POOL,
      "org-1",
      "job-1",
      expect.objectContaining({ cursorAfter: "2026-08-15T00:00:00.000Z" }),
    );
  });
});
