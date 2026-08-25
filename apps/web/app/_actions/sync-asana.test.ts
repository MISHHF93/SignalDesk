import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/sync-asana");
vi.mock("@signaldesk/persistence");

import {
  getAsanaIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshAsanaAccessToken,
  syncAsanaTasks,
} from "../_lib/sync-asana";
import { syncAsanaAction } from "./sync-asana";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetAsanaIntegrationStatus = vi.mocked(getAsanaIntegrationStatus);
const mockedEnsureFreshAccessToken = vi.mocked(ensureFreshAsanaAccessToken);
const mockedSyncAsanaTasks = vi.mocked(syncAsanaTasks);
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
  externalAccountId: "acct-1",
} as unknown as Awaited<ReturnType<typeof getAsanaIntegrationStatus>>;

/**
 * Follows sync-hubspot.test.ts's reference pattern for the "Sync Now"
 * trigger family: ungated by role (ADR 0062), rate limited, requires an
 * active integration, always records a real audit event on both the
 * success and failure path.
 */
describe("syncAsanaAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetAsanaIntegrationStatus.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedEnsureFreshAccessToken.mockResolvedValue("access-token-1");
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await syncAsanaAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Sign in to sync Asana.",
      syncedCount: null,
    });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("does not gate a member session by role — refreshing data is a lower-stakes action any member can trigger", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncAsanaTasks.mockResolvedValue({
      ingested: 3,
      skipped: 0,
    } as Awaited<ReturnType<typeof syncAsanaTasks>>);

    const result = await syncAsanaAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: null, syncedCount: 3 });
  });

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 125,
    });

    const result = await syncAsanaAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Please wait 3 more minute(s) before syncing again.",
      syncedCount: null,
    });
    expect(mockedGetAsanaIntegrationStatus).not.toHaveBeenCalled();
  });

  it("refuses when Asana isn't actively connected", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAsanaIntegrationStatus.mockResolvedValue(null);

    const result = await syncAsanaAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Asana is not currently connected.",
      syncedCount: null,
    });
    expect(mockedSyncAsanaTasks).not.toHaveBeenCalled();
  });

  it("records a real audit event and returns the ingested count on success", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncAsanaTasks.mockResolvedValue({
      ingested: 5,
      skipped: 1,
    } as Awaited<ReturnType<typeof syncAsanaTasks>>);

    const result = await syncAsanaAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: null, syncedCount: 5 });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.completed",
        outcome: "succeeded",
        metadata: expect.objectContaining({
          sourceSystem: "asana",
          tasksIngested: 5,
        }),
      }),
    );
  });

  it("records a real failed audit event and returns a description of the failure when the sync itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncAsanaTasks.mockRejectedValue(new Error("token expired"));

    const result = await syncAsanaAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: "token expired", syncedCount: null });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.failed",
        outcome: "failed",
        metadata: expect.objectContaining({ sourceSystem: "asana" }),
      }),
    );
  });
});
