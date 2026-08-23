"use server";

import {
  createDatabasePool,
  getQuickBooksIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshQuickBooksAccessToken,
  syncQuickBooksInvoices,
  syncQuickBooksPayments,
} from "../_lib/sync-quickbooks";

export interface SyncQuickBooksState {
  readonly error: string | null;
  readonly syncedCount: number | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * "Sync Now" — re-runs the same real invoice fetch/ingest logic the OAuth
 * callback's initial sync uses (`syncQuickBooksInvoices`), refreshing the
 * stored access token first (QuickBooks tokens last only ~1 hour, so this
 * runs on nearly every manual sync, unlike HubSpot's).
 */
export async function syncQuickBooksAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: SyncQuickBooksState,
): Promise<SyncQuickBooksState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to sync QuickBooks.", syncedCount: null };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `quickbooks-sync:${session.organizationId}`,
    1,
    5 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before syncing again.`,
      syncedCount: null,
    };
  }

  const integration = await getQuickBooksIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return {
      error: "QuickBooks is not currently connected.",
      syncedCount: null,
    };
  }

  try {
    const accessToken = await ensureFreshQuickBooksAccessToken(
      getPool(),
      session.organizationId,
      integration.id,
    );

    const [invoiceResult, paymentResult] = await Promise.all([
      syncQuickBooksInvoices(
        getPool(),
        session.organizationId,
        integration.id,
        accessToken,
        integration.externalAccountId,
        "manual",
      ),
      syncQuickBooksPayments(
        getPool(),
        session.organizationId,
        integration.id,
        accessToken,
        integration.externalAccountId,
        "manual",
      ),
    ]);

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.completed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: {
        sourceSystem: "quickbooks",
        invoicesIngested: invoiceResult.ingested,
        invoicesClosed: invoiceResult.closed,
        skipped: invoiceResult.skipped + paymentResult.skipped,
        paymentsIngested: paymentResult.ingested,
        trigger: "manual",
      },
    });

    return {
      error: null,
      syncedCount: invoiceResult.ingested + paymentResult.ingested,
    };
  } catch (error) {
    // The refresh-and-sync call above wraps its own real sync_jobs row
    // (sync-quickbooks.ts), so a token-refresh failure and a sync failure
    // both land here as one bucket — treating "couldn't get a fresh token"
    // as a sync failure is an acceptable simplification, since refreshing
    // is an implicit precondition of syncing, not a materially different
    // outcome worth its own audit event the way the OAuth callback's
    // "authorization succeeded, sync failed" split is.
    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.failed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "failed",
      metadata: {
        sourceSystem: "quickbooks",
        trigger: "manual",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      error: describeActionError(error, "Failed to sync QuickBooks."),
      syncedCount: null,
    };
  }
}
