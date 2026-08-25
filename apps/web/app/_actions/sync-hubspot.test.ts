import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/request-origin");
vi.mock("../_lib/sync-hubspot");
vi.mock("@signaldesk/persistence");

import {
  getHubSpotIntegrationStatus,
  getOrganizationBusinessProfile,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshHubSpotAccessToken,
  syncHubSpotDeals,
} from "../_lib/sync-hubspot";
import { syncHubSpotAction } from "./sync-hubspot";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetHubSpotIntegrationStatus = vi.mocked(
  getHubSpotIntegrationStatus,
);
const mockedEnsureFreshAccessToken = vi.mocked(ensureFreshHubSpotAccessToken);
const mockedGetOrganizationBusinessProfile = vi.mocked(
  getOrganizationBusinessProfile,
);
const mockedSyncHubSpotDeals = vi.mocked(syncHubSpotDeals);
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
} as unknown as Awaited<ReturnType<typeof getHubSpotIntegrationStatus>>;

/**
 * Reference pattern for all 8 "Sync Now" trigger actions
 * (sync-asana/gmail/hubspot/jira/quickbooks/salesforce/xero/zendesk.ts):
 * deliberately ungated by role (ADR 0062 — refreshing already-connected
 * data is a lower-stakes read action any member can trigger), rate
 * limited per-connector, requires an active integration, and always
 * records a real audit event on both the success and failure path (not
 * just success) so a sync failure is actually visible somewhere.
 */
describe("syncHubSpotAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetHubSpotIntegrationStatus.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedEnsureFreshAccessToken.mockResolvedValue("access-token-1");
    mockedGetOrganizationBusinessProfile.mockResolvedValue({
      defaultExpectedResponseHours: 24,
    } as Awaited<ReturnType<typeof getOrganizationBusinessProfile>>);
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await syncHubSpotAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Sign in to sync HubSpot.",
      syncedCount: null,
    });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("does not gate a member session by role — refreshing data is a lower-stakes action any member can trigger", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncHubSpotDeals.mockResolvedValue({
      ingested: 3,
      skipped: 0,
      defaultedNameCount: 0,
    } as Awaited<ReturnType<typeof syncHubSpotDeals>>);

    const result = await syncHubSpotAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: null, syncedCount: 3 });
  });

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 125,
    });

    const result = await syncHubSpotAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "Please wait 3 more minute(s) before syncing again.",
      syncedCount: null,
    });
    expect(mockedGetHubSpotIntegrationStatus).not.toHaveBeenCalled();
  });

  it("refuses when HubSpot isn't actively connected", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetHubSpotIntegrationStatus.mockResolvedValue(null);

    const result = await syncHubSpotAction({ error: null, syncedCount: null });

    expect(result).toEqual({
      error: "HubSpot is not currently connected.",
      syncedCount: null,
    });
    expect(mockedSyncHubSpotDeals).not.toHaveBeenCalled();
  });

  it("records a real audit event and returns the ingested count on success", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncHubSpotDeals.mockResolvedValue({
      ingested: 5,
      skipped: 1,
      defaultedNameCount: 0,
    } as Awaited<ReturnType<typeof syncHubSpotDeals>>);

    const result = await syncHubSpotAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: null, syncedCount: 5 });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.completed",
        outcome: "succeeded",
        metadata: expect.objectContaining({
          sourceSystem: "hubspot",
          dealsIngested: 5,
        }),
      }),
    );
  });

  it("records a real failed audit event and returns a description of the failure when the sync itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncHubSpotDeals.mockRejectedValue(new Error("token expired"));

    const result = await syncHubSpotAction({ error: null, syncedCount: null });

    expect(result).toEqual({ error: "token expired", syncedCount: null });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.failed",
        outcome: "failed",
        metadata: expect.objectContaining({ sourceSystem: "hubspot" }),
      }),
    );
  });
});
