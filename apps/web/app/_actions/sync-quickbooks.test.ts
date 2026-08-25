import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/sync-quickbooks");
vi.mock("@signaldesk/persistence");

import {
  getQuickBooksIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshQuickBooksAccessToken,
  syncQuickBooksInvoices,
  syncQuickBooksPayments,
} from "../_lib/sync-quickbooks";
import { syncQuickBooksAction } from "./sync-quickbooks";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetQuickBooksIntegrationStatus = vi.mocked(
  getQuickBooksIntegrationStatus,
);
const mockedEnsureFreshAccessToken = vi.mocked(
  ensureFreshQuickBooksAccessToken,
);
const mockedSyncQuickBooksInvoices = vi.mocked(syncQuickBooksInvoices);
const mockedSyncQuickBooksPayments = vi.mocked(syncQuickBooksPayments);
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
} as unknown as Awaited<ReturnType<typeof getQuickBooksIntegrationStatus>>;

/**
 * Follows sync-hubspot.test.ts's reference pattern for the "Sync Now"
 * trigger family, with one real, disclosed structural difference: this
 * action runs two independent syncs in parallel (invoices and payments)
 * and reports their combined counts, unlike every other connector's single
 * sync call.
 */
describe("syncQuickBooksAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetQuickBooksIntegrationStatus.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedEnsureFreshAccessToken.mockResolvedValue("access-token-1");
    mockedSyncQuickBooksInvoices.mockResolvedValue({
      ingested: 0,
      closed: 0,
      skipped: 0,
    } as Awaited<ReturnType<typeof syncQuickBooksInvoices>>);
    mockedSyncQuickBooksPayments.mockResolvedValue({
      ingested: 0,
      skipped: 0,
    } as Awaited<ReturnType<typeof syncQuickBooksPayments>>);
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await syncQuickBooksAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({
      error: "Sign in to sync QuickBooks.",
      syncedCount: null,
    });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("does not gate a member session by role — refreshing data is a lower-stakes action any member can trigger", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncQuickBooksInvoices.mockResolvedValue({
      ingested: 3,
      closed: 1,
      skipped: 0,
    } as Awaited<ReturnType<typeof syncQuickBooksInvoices>>);
    mockedSyncQuickBooksPayments.mockResolvedValue({
      ingested: 2,
      skipped: 0,
    } as Awaited<ReturnType<typeof syncQuickBooksPayments>>);

    const result = await syncQuickBooksAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({ error: null, syncedCount: 5 });
  });

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 125,
    });

    const result = await syncQuickBooksAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({
      error: "Please wait 3 more minute(s) before syncing again.",
      syncedCount: null,
    });
    expect(mockedGetQuickBooksIntegrationStatus).not.toHaveBeenCalled();
  });

  it("refuses when QuickBooks isn't actively connected", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetQuickBooksIntegrationStatus.mockResolvedValue(null);

    const result = await syncQuickBooksAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({
      error: "QuickBooks is not currently connected.",
      syncedCount: null,
    });
    expect(mockedSyncQuickBooksInvoices).not.toHaveBeenCalled();
    expect(mockedSyncQuickBooksPayments).not.toHaveBeenCalled();
  });

  it("records a real audit event combining both invoice and payment counts on success", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncQuickBooksInvoices.mockResolvedValue({
      ingested: 5,
      closed: 2,
      skipped: 1,
    } as Awaited<ReturnType<typeof syncQuickBooksInvoices>>);
    mockedSyncQuickBooksPayments.mockResolvedValue({
      ingested: 4,
      skipped: 1,
    } as Awaited<ReturnType<typeof syncQuickBooksPayments>>);

    const result = await syncQuickBooksAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({ error: null, syncedCount: 9 });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.completed",
        outcome: "succeeded",
        metadata: expect.objectContaining({
          sourceSystem: "quickbooks",
          invoicesIngested: 5,
          invoicesClosed: 2,
          paymentsIngested: 4,
          skipped: 2,
        }),
      }),
    );
  });

  it("records a real failed audit event and returns a description of the failure when a sync throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSyncQuickBooksInvoices.mockRejectedValue(new Error("token expired"));

    const result = await syncQuickBooksAction({
      error: null,
      syncedCount: null,
    });

    expect(result).toEqual({ error: "token expired", syncedCount: null });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.failed",
        outcome: "failed",
        metadata: expect.objectContaining({ sourceSystem: "quickbooks" }),
      }),
    );
  });
});
