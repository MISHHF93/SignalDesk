import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("@signaldesk/csv-import");
vi.mock("@signaldesk/persistence");

import { parseInvoiceCsvText } from "@signaldesk/csv-import";
import {
  completeSyncJob,
  ensureCsvImportIntegration,
  failSyncJob,
  ingestCsvInvoice,
  recordAuditEvent,
  startSyncJob,
} from "@signaldesk/persistence";

import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { importCsvInvoicesAction } from "./import-csv-invoices";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedParseInvoiceCsvText = vi.mocked(parseInvoiceCsvText);
const mockedEnsureCsvImportIntegration = vi.mocked(ensureCsvImportIntegration);
const mockedStartSyncJob = vi.mocked(startSyncJob);
const mockedIngestCsvInvoice = vi.mocked(ingestCsvInvoice);
const mockedCompleteSyncJob = vi.mocked(completeSyncJob);
const mockedFailSyncJob = vi.mocked(failSyncJob);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

const VALID_ROW = {
  rowNumber: 2,
  customerName: "Acme",
  amountCents: 1000,
  currency: "USD",
  dueAt: new Date("2026-08-01T00:00:00Z"),
  status: "open" as const,
  invoiceNumber: null,
  contentHash: "hash-1",
};

/**
 * The real write behind the CSV escape hatch — ingests every valid row
 * through the same source_records -> invoices chain a real connector
 * uses, wrapped in a real sync_jobs row. A row-level ingest failure
 * (`ingestCsvInvoice` itself throwing, distinct from an unparseable row
 * `parseInvoiceCsvText` already filtered out) must fail the sync_jobs row
 * honestly rather than leave it stuck 'running'.
 */
describe("importCsvInvoicesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedEnsureCsvImportIntegration.mockResolvedValue({
      id: "integration-1",
    } as Awaited<ReturnType<typeof ensureCsvImportIntegration>>);
    mockedStartSyncJob.mockResolvedValue({
      id: "job-1",
    } as Awaited<ReturnType<typeof startSyncJob>>);
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await importCsvInvoicesAction("csv text");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 65,
    });

    const result = await importCsvInvoicesAction("csv text");

    expect(result).toEqual({
      ok: false,
      error: "Please wait 2 more minute(s) before importing again.",
    });
    expect(mockedParseInvoiceCsvText).not.toHaveBeenCalled();
  });

  it("refuses a file larger than the size cap without ever parsing or writing", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    const oversized = "a".repeat(2_000_001);

    const result = await importCsvInvoicesAction(oversized);

    expect(result).toEqual({
      ok: false,
      error: "File is too large to import.",
    });
    expect(mockedParseInvoiceCsvText).not.toHaveBeenCalled();
    expect(mockedStartSyncJob).not.toHaveBeenCalled();
  });

  it("returns the real header error and starts no sync job when the header is malformed", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedParseInvoiceCsvText.mockReturnValue({
      ok: false,
      headerError: "Missing required column: currency.",
    });

    const result = await importCsvInvoicesAction("bad,header");

    expect(result).toEqual({
      ok: false,
      error: "Missing required column: currency.",
    });
    expect(mockedStartSyncJob).not.toHaveBeenCalled();
  });

  it("ingests every valid row, counts duplicates, and completes the sync job on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedParseInvoiceCsvText.mockReturnValue({
      ok: true,
      validRows: [VALID_ROW, { ...VALID_ROW, rowNumber: 3 }],
      errors: [{ rowNumber: 4, message: "invalid amount_cents" }],
    });
    mockedIngestCsvInvoice
      .mockResolvedValueOnce({
        inserted: true,
      } as Awaited<ReturnType<typeof ingestCsvInvoice>>)
      .mockResolvedValueOnce({
        inserted: false,
      } as Awaited<ReturnType<typeof ingestCsvInvoice>>);

    const result = await importCsvInvoicesAction("csv text");

    expect(result).toEqual({
      ok: true,
      imported: 1,
      duplicates: 1,
      duplicateRows: [3],
      rowErrors: [{ rowNumber: 4, message: "invalid amount_cents" }],
    });
    expect(mockedIngestCsvInvoice).toHaveBeenCalledTimes(2);
    expect(mockedCompleteSyncJob).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "job-1",
      expect.objectContaining({
        itemsIngested: 1,
        // parse errors (1) + duplicates (1)
        itemsSkipped: 2,
      }),
    );
    expect(mockedFailSyncJob).not.toHaveBeenCalled();
    // Real gap found by review: every real connector's own "Sync Now"
    // action records this in addition to its sync_jobs row; this action
    // reused the sync_jobs half of the pattern but not this half.
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        userId: "user-1",
        eventType: "sync.completed",
        subjectType: "integration",
        subjectId: "integration-1",
        outcome: "succeeded",
        metadata: expect.objectContaining({
          sourceSystem: "csv_import",
          imported: 1,
          duplicates: 1,
        }),
      }),
    );
  });

  it("fails the sync job honestly and rethrows a description when a row ingest itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedParseInvoiceCsvText.mockReturnValue({
      ok: true,
      validRows: [VALID_ROW],
      errors: [],
    });
    mockedIngestCsvInvoice.mockRejectedValue(new Error("db write failed"));

    const result = await importCsvInvoicesAction("csv text");

    expect(result).toEqual({
      ok: false,
      error: "db write failed",
    });
    expect(mockedFailSyncJob).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "job-1",
      expect.objectContaining({
        itemsIngested: 0,
        errorMessage: "db write failed",
      }),
    );
    expect(mockedCompleteSyncJob).not.toHaveBeenCalled();
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "sync.failed",
        subjectType: "integration",
        subjectId: "integration-1",
        outcome: "failed",
        metadata: expect.objectContaining({
          sourceSystem: "csv_import",
          error: "db write failed",
        }),
      }),
    );
  });
});
