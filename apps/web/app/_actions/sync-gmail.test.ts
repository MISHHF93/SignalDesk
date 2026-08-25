import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/request-origin");
vi.mock("../_lib/sync-gmail");
vi.mock("@signaldesk/persistence");

import {
  getGmailIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshGmailAccessToken,
  syncGmailMessages,
} from "../_lib/sync-gmail";
import { syncGmailAction } from "./sync-gmail";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetGmailIntegrationStatus = vi.mocked(getGmailIntegrationStatus);
const mockedEnsureFreshAccessToken = vi.mocked(ensureFreshGmailAccessToken);
const mockedSyncGmailMessages = vi.mocked(syncGmailMessages);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

const ACTIVE_INTEGRATION = {
  id: "integration-1",
  status: "active",
  externalAccountLabel: "me@example.com",
} as unknown as Awaited<ReturnType<typeof getGmailIntegrationStatus>>;

/**
 * Follows sync-hubspot.test.ts's reference pattern for the "Sync Now"
 * trigger family, with one real, disclosed extra branch Gmail's own action
 * carries that HubSpot's doesn't: a connected integration with no recorded
 * account address is refused outright, since direction/internal-
 * correspondence filtering both need it (see the source file's own doc
 * comment) — never silently guessed.
 */
describe("syncGmailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetGmailIntegrationStatus.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedEnsureFreshAccessToken.mockResolvedValue("access-token-1");
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await syncGmailAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Sign in to sync Gmail.",
      syncedCount: null,
    });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("does not gate a member session by role — refreshing data is a lower-stakes action any member can trigger", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncGmailMessages.mockResolvedValue({
      ingested: 3,
      filtered: 1,
      skipped: 0,
    } as Awaited<ReturnType<typeof syncGmailMessages>>);

    const result = await syncGmailAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: null, syncedCount: 3 });
  });

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 125,
    });

    const result = await syncGmailAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Please wait 3 more minute(s) before syncing again.",
      syncedCount: null,
    });
    expect(mockedGetGmailIntegrationStatus).not.toHaveBeenCalled();
  });

  it("refuses when Gmail isn't actively connected", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetGmailIntegrationStatus.mockResolvedValue(null);

    const result = await syncGmailAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Gmail is not currently connected.",
      syncedCount: null,
    });
    expect(mockedSyncGmailMessages).not.toHaveBeenCalled();
  });

  it("refuses honestly, never guessing, when the connection has no recorded account address", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetGmailIntegrationStatus.mockResolvedValue({
      id: "integration-1",
      status: "active",
      externalAccountLabel: null,
    } as unknown as Awaited<ReturnType<typeof getGmailIntegrationStatus>>);

    const result = await syncGmailAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error:
        "This Gmail connection has no recorded account address — reconnect Gmail to sync.",
      syncedCount: null,
    });
    expect(mockedSyncGmailMessages).not.toHaveBeenCalled();
  });

  it("records a real audit event and returns the ingested count on success", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncGmailMessages.mockResolvedValue({
      ingested: 5,
      filtered: 2,
      skipped: 1,
    } as Awaited<ReturnType<typeof syncGmailMessages>>);

    const result = await syncGmailAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: null, syncedCount: 5 });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.completed",
        outcome: "succeeded",
        metadata: expect.objectContaining({
          sourceSystem: "gmail",
          messagesIngested: 5,
        }),
      }),
    );
  });

  it("records a real failed audit event and returns a description of the failure when the sync itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncGmailMessages.mockRejectedValue(new Error("token expired"));

    const result = await syncGmailAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: "token expired", syncedCount: null });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.failed",
        outcome: "failed",
        metadata: expect.objectContaining({ sourceSystem: "gmail" }),
      }),
    );
  });
});
