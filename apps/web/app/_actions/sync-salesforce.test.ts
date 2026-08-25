import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/request-origin");
vi.mock("../_lib/sync-salesforce");
vi.mock("@signaldesk/persistence");

import {
  getOrganizationBusinessProfile,
  getSalesforceIntegrationStatus,
  getSalesforceTokens,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { syncSalesforceOpportunities } from "../_lib/sync-salesforce";
import { syncSalesforceAction } from "./sync-salesforce";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetSalesforceIntegrationStatus = vi.mocked(
  getSalesforceIntegrationStatus,
);
const mockedGetSalesforceTokens = vi.mocked(getSalesforceTokens);
const mockedGetOrganizationBusinessProfile = vi.mocked(
  getOrganizationBusinessProfile,
);
const mockedSyncSalesforceOpportunities = vi.mocked(
  syncSalesforceOpportunities,
);
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
} as unknown as Awaited<ReturnType<typeof getSalesforceIntegrationStatus>>;

/**
 * Follows sync-hubspot.test.ts's reference pattern for the "Sync Now"
 * trigger family, with one real, disclosed structural difference (see the
 * source file's own doc comment): there is no separate "ensure fresh
 * token" step here — Salesforce's own sync function reactively refreshes
 * only on a real SalesforceSessionExpiredError, so this action instead has
 * its own extra "no stored tokens" branch before ever calling it.
 */
describe("syncSalesforceAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetSalesforceIntegrationStatus.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedGetSalesforceTokens.mockResolvedValue({
      accessToken: "access-token-1",
    } as Awaited<ReturnType<typeof getSalesforceTokens>>);
    mockedGetOrganizationBusinessProfile.mockResolvedValue({
      defaultExpectedResponseHours: 24,
    } as Awaited<ReturnType<typeof getOrganizationBusinessProfile>>);
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await syncSalesforceAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({
      error: "Sign in to sync Salesforce.",
      syncedCount: null,
    });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("does not gate a member session by role — refreshing data is a lower-stakes action any member can trigger", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncSalesforceOpportunities.mockResolvedValue({
      ingested: 3,
      skipped: 0,
      defaultedNameCount: 0,
    } as Awaited<ReturnType<typeof syncSalesforceOpportunities>>);

    const result = await syncSalesforceAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({ error: null, syncedCount: 3 });
  });

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 125,
    });

    const result = await syncSalesforceAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({
      error: "Please wait 3 more minute(s) before syncing again.",
      syncedCount: null,
    });
    expect(mockedGetSalesforceIntegrationStatus).not.toHaveBeenCalled();
  });

  it("refuses when Salesforce isn't actively connected", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetSalesforceIntegrationStatus.mockResolvedValue(null);

    const result = await syncSalesforceAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({
      error: "Salesforce is not currently connected.",
      syncedCount: null,
    });
    expect(mockedGetSalesforceTokens).not.toHaveBeenCalled();
  });

  it("refuses honestly when there are no stored tokens for this integration", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetSalesforceTokens.mockResolvedValue(null);

    const result = await syncSalesforceAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({
      error: "No stored Salesforce tokens for this integration.",
      syncedCount: null,
    });
    expect(mockedSyncSalesforceOpportunities).not.toHaveBeenCalled();
  });

  it("records a real audit event and returns the ingested count on success", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncSalesforceOpportunities.mockResolvedValue({
      ingested: 5,
      skipped: 1,
      defaultedNameCount: 0,
    } as Awaited<ReturnType<typeof syncSalesforceOpportunities>>);

    const result = await syncSalesforceAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({ error: null, syncedCount: 5 });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.completed",
        outcome: "succeeded",
        metadata: expect.objectContaining({
          sourceSystem: "salesforce",
          opportunitiesIngested: 5,
        }),
      }),
    );
  });

  it("records a real failed audit event and returns a description of the failure when the sync itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncSalesforceOpportunities.mockRejectedValue(
      new Error("session expired"),
    );

    const result = await syncSalesforceAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({ error: "session expired", syncedCount: null });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.failed",
        outcome: "failed",
        metadata: expect.objectContaining({ sourceSystem: "salesforce" }),
      }),
    );
  });
});
