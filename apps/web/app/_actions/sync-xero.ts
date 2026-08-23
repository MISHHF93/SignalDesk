"use server";

import {
  createDatabasePool,
  getXeroIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshXeroAccessToken,
  syncXeroInvoices,
} from "../_lib/sync-xero";

export interface SyncXeroState {
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
 * callback's initial sync uses (`syncXeroInvoices`), refreshing the
 * stored access token first (Xero tokens last only 30 minutes, so this
 * runs on nearly every manual sync — even more often than QuickBooks').
 */
export async function syncXeroAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: SyncXeroState,
): Promise<SyncXeroState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to sync Xero.", syncedCount: null };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `xero-sync:${session.organizationId}`,
    1,
    5 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before syncing again.`,
      syncedCount: null,
    };
  }

  const integration = await getXeroIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Xero is not currently connected.", syncedCount: null };
  }

  try {
    const accessToken = await ensureFreshXeroAccessToken(
      getPool(),
      session.organizationId,
      integration.id,
    );

    const result = await syncXeroInvoices(
      getPool(),
      session.organizationId,
      integration.id,
      accessToken,
      integration.externalAccountId,
      "manual",
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.completed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: {
        sourceSystem: "xero",
        invoicesIngested: result.ingested,
        invoicesClosed: result.closed,
        skipped: result.skipped,
        trigger: "manual",
      },
    });

    return { error: null, syncedCount: result.ingested };
  } catch (error) {
    // See sync-quickbooks.ts's own catch block for why a token-refresh
    // failure and a sync failure share one audit bucket here.
    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.failed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "failed",
      metadata: {
        sourceSystem: "xero",
        trigger: "manual",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      error: describeActionError(error, "Failed to sync Xero."),
      syncedCount: null,
    };
  }
}
