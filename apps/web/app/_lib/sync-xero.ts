import {
  fetchXeroInvoices,
  fetchXeroPaidInvoices,
  mapXeroInvoiceToSourceInvoiceRecord,
  parseXeroDate,
  refreshXeroAccessToken,
  type XeroInvoice,
} from "@signaldesk/integrations/xero";
import {
  completeSyncJob,
  failSyncJob,
  getXeroTokens,
  ingestXeroInvoice,
  listRecentSyncJobsForConnection,
  startSyncJob,
  storeXeroTokens,
  updateInvoiceStatusBySourceRecord,
  type DatabasePool,
  type SyncJobTrigger,
} from "@signaldesk/persistence";
import { parseSourceInvoiceRecord } from "@signaldesk/schemas";

import { errorReporter } from "./error-reporter";
import { logger } from "./logger";
import { getXeroClientCredentials } from "./xero-config";

// Mirrors the QuickBooks sync's own stopgap (see that file's doc comment)
// — bounds a single synchronous sync run, not the org's real invoice
// count.
const MAX_INVOICE_PAGES = 20;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface XeroSyncResult {
  readonly ingested: number;
  readonly skipped: number;
  /** Invoices observed as `Status=="PAID"` since the previous cursor and
   * transitioned to `status: "paid"` — always 0 on an initial sync,
   * mirroring `QuickBooksSyncResult.closed` exactly. */
  readonly closed: number;
}

/**
 * Returns a valid access token for this integration, refreshing and
 * re-persisting it first if it's expired or expiring within 5 minutes.
 * Xero access tokens last only 30 minutes — the shortest of any connector
 * in this codebase — so "Sync Now" needs this on nearly every call, the
 * same proactive-refresh shape QuickBooks/HubSpot use (unlike Salesforce,
 * whose OAuth response discloses no expiry to check against at all).
 */
export async function ensureFreshXeroAccessToken(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<string> {
  const tokens = await getXeroTokens(pool, organizationId, integrationId);

  if (!tokens) {
    throw new Error("No stored Xero tokens for this integration.");
  }

  if (tokens.expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }

  const config = getXeroClientCredentials();
  const refreshed = await refreshXeroAccessToken(config, tokens.refreshToken);

  await storeXeroTokens(pool, organizationId, integrationId, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
  });

  return refreshed.accessToken;
}

/**
 * Fetches and ingests every open (`Status=="AUTHORISED"`) Xero sales
 * invoice, up to `MAX_INVOICE_PAGES` pages. Shared by the OAuth callback's
 * initial sync and "Sync Now" so the two can never silently drift into
 * different behavior — mirrors `syncQuickBooksInvoices`'s exact shape,
 * including its closed-invoice second pass: on an incremental run (a
 * non-null `cursorBefore`), a second pass fetches invoices that reached
 * `Status=="PAID"` since that cursor and transitions each to
 * `status: "paid"` via the same provider-neutral
 * `updateInvoiceStatusBySourceRecord` QuickBooks' own pass uses — an
 * initial sync (no prior cursor) skips this pass, since nothing has been
 * observed as open yet to transition.
 */
export async function syncXeroInvoices(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  accessToken: string,
  tenantId: string,
  trigger: SyncJobTrigger,
): Promise<XeroSyncResult> {
  const now = new Date();
  const [previousJob] = await listRecentSyncJobsForConnection(
    pool,
    organizationId,
    integrationId,
    1,
    "invoice",
  );
  const cursorBefore = previousJob?.cursorAfter ?? null;
  const job = await startSyncJob(
    pool,
    organizationId,
    integrationId,
    "xero",
    "invoice",
    trigger,
    cursorBefore,
  );

  let ingested = 0;
  let skipped = 0;
  let closed = 0;
  let maxCursor: string | null = cursorBefore;

  try {
    for (let page = 1; page <= MAX_INVOICE_PAGES; page += 1) {
      const invoicePage = await fetchXeroInvoices(
        accessToken,
        tenantId,
        page,
        cursorBefore,
      );

      for (const rawInvoice of invoicePage.results as readonly XeroInvoice[]) {
        const mapped = mapXeroInvoiceToSourceInvoiceRecord(rawInvoice, now);

        if (mapped === null) {
          continue;
        }

        let invoiceRecord: ReturnType<typeof parseSourceInvoiceRecord>;

        try {
          invoiceRecord = parseSourceInvoiceRecord(mapped, {
            organizationId,
            integrationId,
          });
        } catch (validationError) {
          errorReporter.captureException(validationError, {
            operation: "sync_xero.invoice_validation",
            connectorSlug: "xero",
            organizationId,
            correlationId: integrationId,
          });
          skipped += 1;
          continue;
        }

        if (!maxCursor || invoiceRecord.source.sourceVersion > maxCursor) {
          maxCursor = invoiceRecord.source.sourceVersion;
        }

        const result = await ingestXeroInvoice(
          pool,
          organizationId,
          integrationId,
          {
            externalRecordId: invoiceRecord.source.externalRecordId,
            sourceVersion: invoiceRecord.source.sourceVersion,
            rawPayloadSha256: invoiceRecord.source.recordDigestSha256,
            rawPayloadByteLength: JSON.stringify(rawInvoice).length,
            observedAt: now,
            customerName: invoiceRecord.customerName,
            amountCents: invoiceRecord.amountCents,
            currency: invoiceRecord.currency,
            dueAt: invoiceRecord.dueAt,
            status: invoiceRecord.status,
            syncJobId: job.id,
          },
        );

        if (result.inserted) {
          ingested += 1;
        }
      }

      if (!invoicePage.hasMore) {
        break;
      }
    }

    if (cursorBefore) {
      for (let page = 1; page <= MAX_INVOICE_PAGES; page += 1) {
        const paidPage = await fetchXeroPaidInvoices(
          accessToken,
          tenantId,
          page,
          cursorBefore,
        );

        for (const rawInvoice of paidPage.results as readonly XeroInvoice[]) {
          // Unlike the open-invoice pass above, this loop never runs the
          // full mapper (there's nothing to ingest, only a status
          // transition) — so `UpdatedDateUTC` is still in Xero's raw
          // `/Date(...)/ ` wire format here and must be parsed before it
          // can validly extend the ISO-formatted cursor.
          try {
            const updatedAtIso = parseXeroDate(
              rawInvoice.UpdatedDateUTC,
            ).toISOString();

            if (!maxCursor || updatedAtIso > maxCursor) {
              maxCursor = updatedAtIso;
            }
          } catch {
            // A malformed UpdatedDateUTC here doesn't block the real
            // status transition below — only the cursor advancement.
          }

          const wasUpdated = await updateInvoiceStatusBySourceRecord(
            pool,
            organizationId,
            "xero",
            rawInvoice.InvoiceID,
            "paid",
          );

          if (wasUpdated) {
            closed += 1;
          }
        }

        if (!paidPage.hasMore) {
          break;
        }
      }
    }
  } catch (error) {
    await failSyncJob(pool, organizationId, job.id, {
      itemsIngested: ingested,
      itemsSkipped: skipped,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await completeSyncJob(pool, organizationId, job.id, {
    itemsIngested: ingested,
    itemsSkipped: skipped,
    cursorAfter: maxCursor,
  });

  if (skipped > 0) {
    logger.log(
      "warn",
      `Xero sync: skipped ${skipped} invoice(s) that failed validation.`,
      {
        operation: "sync_xero.invoice_summary",
        connectorSlug: "xero",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  return { ingested, skipped, closed };
}
