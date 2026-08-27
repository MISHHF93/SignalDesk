import {
  detectQuickBooksInvoiceDefaultedFields,
  detectQuickBooksPaymentDefaultedFields,
  fetchQuickBooksClosedInvoices,
  fetchQuickBooksInvoices,
  fetchQuickBooksPayments,
  mapQuickBooksInvoiceToSourceInvoiceRecord,
  mapQuickBooksPaymentToSourcePaymentRecord,
  refreshQuickBooksAccessToken,
  type QuickBooksInvoice,
  type QuickBooksPayment,
} from "@signaldesk/integrations/quickbooks";
import {
  completeSyncJob,
  failSyncJob,
  getQuickBooksTokens,
  ingestQuickBooksInvoice,
  ingestQuickBooksPayment,
  listRecentSyncJobsForConnection,
  startSyncJob,
  storeQuickBooksTokens,
  updateInvoiceStatusBySourceRecord,
  withAdvisoryLock,
  type DatabasePool,
  type SyncJobTrigger,
} from "@signaldesk/persistence";
import {
  parseSourceInvoiceRecord,
  parseSourcePaymentRecord,
} from "@signaldesk/schemas";

import { errorReporter } from "./error-reporter";
import { logger } from "./logger";
import { getQuickBooksClientCredentials } from "./quickbooks-config";

// Mirrors the OAuth callback's own stopgap.
const MAX_INVOICE_PAGES = 20;
const MAX_PAYMENT_PAGES = 20;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_LOCK_MAX_ATTEMPTS = 5;
const TOKEN_REFRESH_LOCK_RETRY_DELAY_MS = 300;

/**
 * Whether `candidate` (a real `MetaData.LastUpdatedTime`) is chronologically
 * later than `current` (the running cursor) — compared as real instants,
 * never as raw strings. QuickBooks returns this timestamp in the company
 * file's own local UTC offset, not normalized (`"2026-08-17T09:30:00.000-07:00"`,
 * confirmed against this connector's own test fixture), so a genuinely
 * later timestamp can sort lexicographically *smaller* around a DST
 * transition — e.g. `"...T01:15:00.000-08:00"` (after the fall-back,
 * chronologically later) versus `"...T01:30:00.000-07:00"` (just before
 * it): plain string `&gt;` judges the second string bigger ("30" &gt; "15"
 * at the same character position) even though it happened first in real
 * time, which would make a plain-string-compared cursor fail to advance
 * past a record it already saw — found by a deep audit, 2026-08-22.
 */
function isLaterCursor(candidate: string, current: string | null): boolean {
  return (
    !current || new Date(candidate).getTime() > new Date(current).getTime()
  );
}

export interface QuickBooksSyncResult {
  readonly ingested: number;
  readonly skipped: number;
  /** Invoices observed as closed (`Balance = '0'`) since the previous
   * cursor and transitioned to `status: "paid"` — always 0 on an initial
   * sync (nothing has been observed as open yet to transition). */
  readonly closed: number;
  /** Records whose `CustomerRef.name` was missing and fell back to a
   * placeholder (`detectQuickBooksInvoiceDefaultedFields`/
   * `detectQuickBooksPaymentDefaultedFields`) — mirrors
   * `sync-hubspot.ts`'s own `defaultedNameCount`: logged for visibility,
   * deliberately never folded into `skipped`, since the record still
   * ingested successfully. */
  readonly defaultedNameCount: number;
}

/**
 * Returns a valid access token for this integration, refreshing and
 * re-persisting it first if it's expired or expiring within 5 minutes.
 * QuickBooks access tokens last only ~1 hour, so unlike the OAuth
 * callback (always freshly exchanged), "Sync Now" needs this on nearly
 * every call. QuickBooks also rotates the refresh token itself on every
 * use — the newly-returned one must be persisted too, or the next refresh
 * will fail.
 *
 * Real bug found by review: this used to read-check-refresh-store with no
 * locking at all. Two concurrent callers for the same integration (a
 * scheduled "Sync Now" and a manual approve action, say) could both read
 * the same near-expiry token and both call `refreshQuickBooksAccessToken`
 * with it — since QuickBooks rotates the refresh token on every use, only
 * one of those two calls can actually succeed; the other gets a genuine
 * `invalid_grant` rejection and fails outright.
 *
 * Fixed with the same real, cross-instance Postgres advisory lock
 * (`withAdvisoryLock`) this codebase already uses for other external-API
 * critical sections — but since it's non-blocking (returns `null`
 * immediately when another caller already holds the key, rather than
 * queuing), a losing caller here re-checks the stored tokens (the winner
 * may have already refreshed and committed) and retries the whole
 * function after a short delay, up to `TOKEN_REFRESH_LOCK_MAX_ATTEMPTS`
 * times, instead of racing its own refresh call against the winner's.
 */
export async function ensureFreshQuickBooksAccessToken(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  attempt = 0,
): Promise<string> {
  const tokens = await getQuickBooksTokens(pool, organizationId, integrationId);

  if (!tokens) {
    throw new Error("No stored QuickBooks tokens for this integration.");
  }

  if (tokens.expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }

  const refreshedAccessToken = await withAdvisoryLock(
    pool,
    `quickbooks-token-refresh:${integrationId}`,
    async (): Promise<string> => {
      // Re-read inside the lock — a concurrent caller may have already
      // refreshed and stored a fresh token while we were waiting to
      // acquire it.
      const currentTokens =
        (await getQuickBooksTokens(pool, organizationId, integrationId)) ??
        tokens;

      if (
        currentTokens.expiresAt.getTime() - Date.now() >
        TOKEN_REFRESH_BUFFER_MS
      ) {
        return currentTokens.accessToken;
      }

      const config = getQuickBooksClientCredentials();
      const refreshed = await refreshQuickBooksAccessToken(
        config,
        currentTokens.refreshToken,
      );

      await storeQuickBooksTokens(pool, organizationId, integrationId, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      });

      return refreshed.accessToken;
    },
  );

  if (refreshedAccessToken !== null) {
    return refreshedAccessToken;
  }

  if (attempt >= TOKEN_REFRESH_LOCK_MAX_ATTEMPTS) {
    throw new Error(
      "Could not refresh the QuickBooks access token — another refresh for this connection was already in progress.",
    );
  }

  await new Promise((resolve) =>
    setTimeout(resolve, TOKEN_REFRESH_LOCK_RETRY_DELAY_MS),
  );

  return ensureFreshQuickBooksAccessToken(
    pool,
    organizationId,
    integrationId,
    attempt + 1,
  );
}

/**
 * Fetches and ingests every open, overdue QuickBooks invoice, up to
 * `MAX_INVOICE_PAGES` pages. Shared by the OAuth callback's initial sync,
 * "Sync Now", and the webhook handler. Wraps the run in a real
 * `sync_jobs` row (`entityType: "invoice"`, ADR 0021/0022): on an
 * incremental run (a non-null `cursorBefore`), the fetch query is now
 * filtered to `MetaData.LastUpdatedTime > cursorBefore`
 * (`incrementalSyncImplemented: true`) and a second pass fetches invoices
 * that closed (`Balance` reached `'0'`) since that cursor, transitioning
 * each to `status: "paid"` — an initial sync (no prior cursor) still
 * pulls the full open set and skips the closed-invoice pass, since
 * nothing has been observed as open yet to transition.
 */
export async function syncQuickBooksInvoices(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  accessToken: string,
  realmId: string,
  trigger: SyncJobTrigger,
): Promise<QuickBooksSyncResult> {
  const now = new Date();
  const [previousJob] = await listRecentSyncJobsForConnection(
    pool,
    organizationId,
    integrationId,
    1,
    "invoice",
    true,
  );
  const cursorBefore = previousJob?.cursorAfter ?? null;
  const job = await startSyncJob(
    pool,
    organizationId,
    integrationId,
    "quickbooks",
    "invoice",
    trigger,
    cursorBefore,
  );

  let ingested = 0;
  let skipped = 0;
  let closed = 0;
  let defaultedNameCount = 0;
  let maxCursor: string | null = cursorBefore;

  try {
    for (let page = 0; page < MAX_INVOICE_PAGES; page += 1) {
      const invoicePage = await fetchQuickBooksInvoices(
        accessToken,
        realmId,
        page * 100,
        cursorBefore,
      );

      for (const rawInvoice of invoicePage.results as readonly QuickBooksInvoice[]) {
        const seenAt = rawInvoice.MetaData?.LastUpdatedTime;

        if (seenAt && isLaterCursor(seenAt, maxCursor)) {
          maxCursor = seenAt;
        }

        const mapped = mapQuickBooksInvoiceToSourceInvoiceRecord(
          rawInvoice,
          now,
        );

        if (mapped === null) {
          // Not a sync failure — a real invoice with no DueDate set in
          // QuickBooks. Logged (not counted in `skipped`) so it doesn't
          // fold into `completeSyncJob`'s `itemsSkipped > 0` check and
          // wrongly mark a perfectly healthy connection "degraded".
          logger.log(
            "info",
            `QuickBooks invoice ${rawInvoice.Id} has no DueDate; not ingested.`,
            {
              operation: "sync_quickbooks.invoice_no_due_date",
              connectorSlug: "quickbooks",
              organizationId,
              correlationId: integrationId,
            },
          );
          continue;
        }

        if (detectQuickBooksInvoiceDefaultedFields(rawInvoice).length > 0) {
          defaultedNameCount += 1;
        }

        let invoiceRecord: ReturnType<typeof parseSourceInvoiceRecord>;

        try {
          invoiceRecord = parseSourceInvoiceRecord(mapped, {
            organizationId,
            integrationId,
          });
        } catch (validationError) {
          errorReporter.captureException(validationError, {
            operation: "sync_quickbooks.invoice_validation",
            connectorSlug: "quickbooks",
            organizationId,
            correlationId: integrationId,
          });
          skipped += 1;
          continue;
        }

        const result = await ingestQuickBooksInvoice(
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
      for (let page = 0; page < MAX_INVOICE_PAGES; page += 1) {
        const closedPage = await fetchQuickBooksClosedInvoices(
          accessToken,
          realmId,
          page * 100,
          cursorBefore,
        );

        for (const rawInvoice of closedPage.results as readonly QuickBooksInvoice[]) {
          const seenAt = rawInvoice.MetaData?.LastUpdatedTime;

          if (seenAt && isLaterCursor(seenAt, maxCursor)) {
            maxCursor = seenAt;
          }

          const wasUpdated = await updateInvoiceStatusBySourceRecord(
            pool,
            organizationId,
            "quickbooks",
            rawInvoice.Id,
            "paid",
          );

          if (wasUpdated) {
            closed += 1;
          }
        }

        if (!closedPage.hasMore) {
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
      `QuickBooks sync: skipped ${skipped} invoice(s) that failed validation.`,
      {
        operation: "sync_quickbooks.invoice_summary",
        connectorSlug: "quickbooks",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  if (defaultedNameCount > 0) {
    logger.log(
      "warn",
      `QuickBooks sync: ${defaultedNameCount} invoice(s) had no usable CustomerRef.name and fell back to a placeholder.`,
      {
        operation: "sync_quickbooks.invoice_defaulted_name",
        connectorSlug: "quickbooks",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  return { ingested, skipped, closed, defaultedNameCount };
}

/**
 * Fetches and ingests every QuickBooks payment, up to `MAX_PAYMENT_PAGES`
 * pages. Same shape as `syncQuickBooksInvoices` — its own `sync_jobs` row
 * (`entityType: "payment"`, tracked independently so its cursor never
 * collides with the invoice sync's), incremental filtering once a prior
 * cursor exists.
 */
export async function syncQuickBooksPayments(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  accessToken: string,
  realmId: string,
  trigger: SyncJobTrigger,
): Promise<QuickBooksSyncResult> {
  const now = new Date();
  const [previousJob] = await listRecentSyncJobsForConnection(
    pool,
    organizationId,
    integrationId,
    1,
    "payment",
    true,
  );
  const cursorBefore = previousJob?.cursorAfter ?? null;
  const job = await startSyncJob(
    pool,
    organizationId,
    integrationId,
    "quickbooks",
    "payment",
    trigger,
    cursorBefore,
  );

  let ingested = 0;
  let skipped = 0;
  let defaultedNameCount = 0;
  let maxCursor: string | null = cursorBefore;

  try {
    for (let page = 0; page < MAX_PAYMENT_PAGES; page += 1) {
      const paymentPage = await fetchQuickBooksPayments(
        accessToken,
        realmId,
        page * 100,
        cursorBefore,
      );

      for (const rawPayment of paymentPage.results as readonly QuickBooksPayment[]) {
        const seenAt = rawPayment.MetaData?.LastUpdatedTime;

        if (seenAt && isLaterCursor(seenAt, maxCursor)) {
          maxCursor = seenAt;
        }

        const mapped = mapQuickBooksPaymentToSourcePaymentRecord(
          rawPayment,
          now,
        );

        if (detectQuickBooksPaymentDefaultedFields(rawPayment).length > 0) {
          defaultedNameCount += 1;
        }

        let paymentRecord: ReturnType<typeof parseSourcePaymentRecord>;

        try {
          paymentRecord = parseSourcePaymentRecord(mapped, {
            organizationId,
            integrationId,
          });
        } catch (validationError) {
          errorReporter.captureException(validationError, {
            operation: "sync_quickbooks.payment_validation",
            connectorSlug: "quickbooks",
            organizationId,
            correlationId: integrationId,
          });
          skipped += 1;
          continue;
        }

        const result = await ingestQuickBooksPayment(
          pool,
          organizationId,
          integrationId,
          {
            externalRecordId: paymentRecord.source.externalRecordId,
            sourceVersion: paymentRecord.source.sourceVersion,
            rawPayloadSha256: paymentRecord.source.recordDigestSha256,
            rawPayloadByteLength: JSON.stringify(rawPayment).length,
            observedAt: now,
            customerName: paymentRecord.customerName,
            amountCents: paymentRecord.amountCents,
            currency: paymentRecord.currency,
            receivedAt: paymentRecord.receivedAt,
            invoiceAllocations: paymentRecord.invoiceAllocations,
            syncJobId: job.id,
          },
        );

        if (result.inserted) {
          ingested += 1;
        }
      }

      if (!paymentPage.hasMore) {
        break;
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
      `QuickBooks sync: skipped ${skipped} payment(s) that failed validation.`,
      {
        operation: "sync_quickbooks.payment_summary",
        connectorSlug: "quickbooks",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  if (defaultedNameCount > 0) {
    logger.log(
      "warn",
      `QuickBooks sync: ${defaultedNameCount} payment(s) had no usable CustomerRef.name and fell back to a placeholder.`,
      {
        operation: "sync_quickbooks.payment_defaulted_name",
        connectorSlug: "quickbooks",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  return { ingested, skipped, closed: 0, defaultedNameCount };
}
