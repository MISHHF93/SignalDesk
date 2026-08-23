"use server";

import { parseInvoiceCsvText } from "@signaldesk/csv-import";
import {
  completeSyncJob,
  createDatabasePool,
  ensureCsvImportIntegration,
  failSyncJob,
  ingestCsvInvoice,
  startSyncJob,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { ImportCsvInvoicesActionResult } from "../_lib/actions";
import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const MAX_CSV_TEXT_LENGTH = 2_000_000;

/**
 * The real write behind the CSV escape hatch (Prompt 28,
 * docs/product-vision-backlog.md, ADR 0038) — re-parses `csvText`
 * server-side (never trusts a client-echoed parse), then ingests every
 * valid row through the exact same `source_records` → `invoices`
 * provenance chain a real connector uses, wrapped in a real `sync_jobs`
 * row (`sourceSystem: "csv_import"`) so this shows up in the same
 * observability surface every other sync does. A row that fails
 * validation is skipped and counted, never aborts the whole import —
 * matching `syncQuickBooksInvoices`'s own "skip and report" behavior.
 * Rate-limited the same way every other real-sync "Sync Now" action
 * already is (1 per 5 minutes) — this does one real DB write per row,
 * sequentially, up to `MAX_CSV_TEXT_LENGTH` of input, which every
 * connector's own sync action treats as worth throttling; this one
 * hadn't been, until found by a deep audit, 2026-08-22.
 */
export async function importCsvInvoicesAction(
  csvText: string,
): Promise<ImportCsvInvoicesActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const rateLimit = await checkRateLimit(
      getPool(),
      `csv-import:${session.organizationId}`,
      1,
      5 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      return {
        ok: false,
        error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before importing again.`,
      };
    }

    if (csvText.length > MAX_CSV_TEXT_LENGTH) {
      return { ok: false, error: "File is too large to import." };
    }

    const parsed = parseInvoiceCsvText(csvText);

    if (!parsed.ok) {
      return { ok: false, error: parsed.headerError };
    }

    const db = getPool();
    const integration = await ensureCsvImportIntegration(
      db,
      session.organizationId,
    );
    const job = await startSyncJob(
      db,
      session.organizationId,
      integration.id,
      "csv_import",
      "invoice",
      "manual",
      null,
    );

    let imported = 0;
    let duplicates = 0;

    try {
      for (const row of parsed.validRows) {
        const result = await ingestCsvInvoice(
          db,
          session.organizationId,
          integration.id,
          {
            contentHash: row.contentHash,
            customerName: row.customerName,
            amountCents: row.amountCents,
            currency: row.currency,
            dueAt: row.dueAt,
            status: row.status,
            syncJobId: job.id,
          },
        );

        if (result.inserted) {
          imported += 1;
        } else {
          duplicates += 1;
        }
      }
    } catch (error) {
      await failSyncJob(db, session.organizationId, job.id, {
        itemsIngested: imported,
        itemsSkipped: parsed.errors.length + duplicates,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    await completeSyncJob(db, session.organizationId, job.id, {
      itemsIngested: imported,
      itemsSkipped: parsed.errors.length + duplicates,
      cursorAfter: null,
    });

    return {
      ok: true,
      imported,
      duplicates,
      rowErrors: parsed.errors.map((error) => ({
        rowNumber: error.rowNumber,
        message: error.message,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to import the file."),
    };
  }
}
