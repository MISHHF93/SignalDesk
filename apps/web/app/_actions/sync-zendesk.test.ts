import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/sync-zendesk");
vi.mock("@signaldesk/persistence");

import {
  getZendeskIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshZendeskAccessToken,
  syncZendeskTickets,
} from "../_lib/sync-zendesk";
import { syncZendeskAction } from "./sync-zendesk";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetZendeskIntegrationStatus = vi.mocked(
  getZendeskIntegrationStatus,
);
const mockedEnsureFreshAccessToken = vi.mocked(ensureFreshZendeskAccessToken);
const mockedSyncZendeskTickets = vi.mocked(syncZendeskTickets);
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
} as unknown as Awaited<ReturnType<typeof getZendeskIntegrationStatus>>;

/**
 * Follows sync-hubspot.test.ts's reference pattern for the "Sync Now"
 * trigger family: ungated by role (ADR 0062), rate limited, requires an
 * active integration, always records a real audit event on both the
 * success and failure path.
 */
describe("syncZendeskAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetZendeskIntegrationStatus.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedEnsureFreshAccessToken.mockResolvedValue("access-token-1");
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await syncZendeskAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Sign in to sync Zendesk.",
      syncedCount: null,
    });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("does not gate a member session by role — refreshing data is a lower-stakes action any member can trigger", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncZendeskTickets.mockResolvedValue({
      ingested: 3,
      skipped: 0,
    } as Awaited<ReturnType<typeof syncZendeskTickets>>);

    const result = await syncZendeskAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: null, syncedCount: 3 });
  });

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 125,
    });

    const result = await syncZendeskAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Please wait 3 more minute(s) before syncing again.",
      syncedCount: null,
    });
    expect(mockedGetZendeskIntegrationStatus).not.toHaveBeenCalled();
  });

  it("refuses when Zendesk isn't actively connected", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetZendeskIntegrationStatus.mockResolvedValue(null);

    const result = await syncZendeskAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Zendesk is not currently connected.",
      syncedCount: null,
    });
    expect(mockedSyncZendeskTickets).not.toHaveBeenCalled();
  });

  it("records a real audit event and returns the ingested count on success", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncZendeskTickets.mockResolvedValue({
      ingested: 5,
      skipped: 1,
    } as Awaited<ReturnType<typeof syncZendeskTickets>>);

    const result = await syncZendeskAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: null, syncedCount: 5 });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.completed",
        outcome: "succeeded",
        metadata: expect.objectContaining({
          sourceSystem: "zendesk",
          ticketsIngested: 5,
        }),
      }),
    );
  });

  it("records a real failed audit event and returns a description of the failure when the sync itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncZendeskTickets.mockRejectedValue(new Error("token expired"));

    const result = await syncZendeskAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: "token expired", syncedCount: null });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.failed",
        outcome: "failed",
        metadata: expect.objectContaining({ sourceSystem: "zendesk" }),
      }),
    );
  });
});
