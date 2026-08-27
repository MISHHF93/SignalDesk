import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/gmail");
vi.mock("./google-config");

import {
  getGmailMessage,
  listGmailMessages,
  mapGmailMessageToSourceMessageRecord,
  refreshGmailAccessToken,
} from "@signaldesk/integrations/gmail";
import {
  completeSyncJob,
  getGmailTokens,
  listRecentSyncJobsForConnection,
  startSyncJob,
  storeGmailTokens,
  withAdvisoryLock,
  type DatabasePool,
  type SyncJob,
} from "@signaldesk/persistence";

import { getGoogleOAuthConfig } from "./google-config";
import { ensureFreshGmailAccessToken, syncGmailMessages } from "./sync-gmail";

const POOL = undefined as unknown as DatabasePool;

const mockedGetGmailTokens = vi.mocked(getGmailTokens);
const mockedStoreGmailTokens = vi.mocked(storeGmailTokens);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedRefreshGmailAccessToken = vi.mocked(refreshGmailAccessToken);
const mockedGetGoogleOAuthConfig = vi.mocked(getGoogleOAuthConfig);
const mockedListGmailMessages = vi.mocked(listGmailMessages);
const mockedGetGmailMessage = vi.mocked(getGmailMessage);
const mockedMapGmailMessageToSourceMessageRecord = vi.mocked(
  mapGmailMessageToSourceMessageRecord,
);
const mockedListRecentSyncJobsForConnection = vi.mocked(
  listRecentSyncJobsForConnection,
);
const mockedStartSyncJob = vi.mocked(startSyncJob);
const mockedCompleteSyncJob = vi.mocked(completeSyncJob);

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

function fakeSyncJob(overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    id: "job-1",
    organizationId: "org-1",
    integrationId: "integration-1",
    sourceSystem: "gmail",
    entityType: "message",
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

function fakeGmailMessage(id: string, internalDate: string) {
  return {
    id,
    threadId: `thread-${id}`,
    internalDate,
    payload: { headers: [] },
  };
}

/**
 * Real behavioral coverage for a function that had none: proves the fix
 * for a real bug found by review — Gmail's `users.messages.list` has no
 * sort parameter and is documented/known to return results newest-first,
 * so advancing the cursor to the maximum `internalDate` seen in a
 * page-capped or body-fetch-capped run could permanently skip older,
 * unprocessed messages in the same window with no signal. A truncated
 * run must leave the cursor unchanged instead.
 */
describe("syncGmailMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStartSyncJob.mockResolvedValue(fakeSyncJob());
    // No due-date-shaped concept for messages — mapped to null (filtered,
    // not a failure) so this test only exercises the cursor-truncation
    // logic, not the full ingestion pipeline.
    mockedMapGmailMessageToSourceMessageRecord.mockReturnValue(null);
  });

  it("regression: does not advance the cursor when the body-fetch cap is hit with more messages remaining in the same page", async () => {
    mockedListRecentSyncJobsForConnection.mockResolvedValue([
      fakeSyncJob({
        status: "succeeded",
        cursorAfter: "1700000000000",
      }),
    ]);
    // 301 items in one page — Gmail returns newest-first, so item 0 is
    // the newest and would (wrongly, pre-fix) become maxCursor even
    // though items past the 300th body fetch are never even read.
    const results = Array.from({ length: 301 }, (_, i) => ({
      id: `msg-${i}`,
      threadId: `thread-${i}`,
    }));
    mockedListGmailMessages.mockResolvedValue({
      results,
      nextPageToken: null,
    });
    mockedGetGmailMessage.mockImplementation(async (_at, id) =>
      fakeGmailMessage(id, "1700099999999"),
    );

    await syncGmailMessages(
      POOL,
      "org-1",
      "integration-1",
      "at-1",
      "me@example.com",
      "manual",
    );

    // Capped at MAX_MESSAGE_BODY_FETCHES (300), not all 301.
    expect(mockedGetGmailMessage).toHaveBeenCalledTimes(300);
    expect(mockedCompleteSyncJob).toHaveBeenCalledWith(
      POOL,
      "org-1",
      "job-1",
      expect.objectContaining({ cursorAfter: "1700000000000" }),
    );
  });

  it("advances the cursor normally when the run completes within both caps", async () => {
    mockedListRecentSyncJobsForConnection.mockResolvedValue([
      fakeSyncJob({
        status: "succeeded",
        cursorAfter: "1700000000000",
      }),
    ]);
    mockedListGmailMessages.mockResolvedValue({
      results: [{ id: "msg-1", threadId: "thread-1" }],
      nextPageToken: null,
    });
    mockedGetGmailMessage.mockResolvedValue(
      fakeGmailMessage("msg-1", "1700050000000"),
    );

    await syncGmailMessages(
      POOL,
      "org-1",
      "integration-1",
      "at-1",
      "me@example.com",
      "manual",
    );

    expect(mockedCompleteSyncJob).toHaveBeenCalledWith(
      POOL,
      "org-1",
      "job-1",
      expect.objectContaining({ cursorAfter: "1700050000000" }),
    );
  });
});
