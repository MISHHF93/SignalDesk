"use server";

import {
  createDatabasePool,
  getAsanaIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshAsanaAccessToken,
  syncAsanaTasks,
} from "../_lib/sync-asana";

export interface SyncAsanaState {
  readonly error: string | null;
  readonly syncedCount: number | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * "Sync Now" — re-runs the same real task fetch/ingest logic the OAuth
 * callback's initial sync uses (`syncAsanaTasks`), refreshing the stored
 * access token first (Asana tokens last only ~1 hour, so this runs on
 * nearly every manual sync, unlike HubSpot's).
 */
export async function syncAsanaAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: SyncAsanaState,
): Promise<SyncAsanaState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to sync Asana.", syncedCount: null };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `asana-sync:${session.organizationId}`,
    1,
    5 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before syncing again.`,
      syncedCount: null,
    };
  }

  const integration = await getAsanaIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Asana is not currently connected.", syncedCount: null };
  }

  try {
    const accessToken = await ensureFreshAsanaAccessToken(
      getPool(),
      session.organizationId,
      integration.id,
    );

    const { ingested, skipped } = await syncAsanaTasks(
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
        sourceSystem: "asana",
        tasksIngested: ingested,
        skipped,
        trigger: "manual",
      },
    });

    return { error: null, syncedCount: ingested };
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
        sourceSystem: "asana",
        trigger: "manual",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      error: describeActionError(error, "Failed to sync Asana."),
      syncedCount: null,
    };
  }
}
