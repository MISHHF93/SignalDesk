"use server";

import { parseInvoiceCsvText } from "@signaldesk/csv-import";
import { createDatabasePool, type DatabasePool } from "@signaldesk/persistence";

import type { PreviewCsvInvoiceImportActionResult } from "../_lib/actions";
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
 * Dry-run only — parses and validates, writes nothing (Prompt 28,
 * docs/product-vision-backlog.md, ADR 0038's own "preview transformations
 * before import" / "dry-run results" requirement). The confirm step
 * (`importCsvInvoicesAction`) re-parses the same text server-side rather
 * than trusting a client-echoed parsed result.
 */
export async function previewCsvInvoiceImportAction(
  csvText: string,
): Promise<PreviewCsvInvoiceImportActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    // More permissive than the confirm step's 1-per-5-minutes: this is a
    // read-only dry run meant for iterating (fix a row, re-preview), not a
    // one-shot action — but still bounded, since it's real server-side CPU
    // work on up to MAX_CSV_TEXT_LENGTH of text per call.
    const rateLimit = await checkRateLimit(
      getPool(),
      `csv-import-preview:${session.organizationId}`,
      10,
      5 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      return {
        ok: false,
        error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before previewing again.`,
      };
    }

    if (csvText.length > MAX_CSV_TEXT_LENGTH) {
      return { ok: false, error: "File is too large to preview." };
    }

    const result = parseInvoiceCsvText(csvText);

    if (!result.ok) {
      return { ok: false, error: result.headerError };
    }

    return {
      ok: true,
      validRowCount: result.validRows.length,
      errors: result.errors.map((error) => ({
        rowNumber: error.rowNumber,
        message: error.message,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to preview the file."),
    };
  }
}
