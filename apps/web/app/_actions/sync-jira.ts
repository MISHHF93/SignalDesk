"use server";

import {
  createDatabasePool,
  getJiraIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { ensureFreshJiraAccessToken, syncJiraIssues } from "../_lib/sync-jira";

export interface SyncJiraState {
  readonly error: string | null;
  readonly syncedCount: number | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * "Sync Now" — re-runs the same real issue fetch/ingest logic the OAuth
 * callback's initial sync uses (`syncJiraIssues`), refreshing the stored
 * access token first (Jira tokens last only 1 hour, so this runs on
 * nearly every manual sync, the same as QuickBooks').
 */
export async function syncJiraAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: SyncJiraState,
): Promise<SyncJiraState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to sync Jira.", syncedCount: null };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `jira-sync:${session.organizationId}`,
    1,
    5 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before syncing again.`,
      syncedCount: null,
    };
  }

  const integration = await getJiraIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Jira is not currently connected.", syncedCount: null };
  }

  try {
    const accessToken = await ensureFreshJiraAccessToken(
      getPool(),
      session.organizationId,
      integration.id,
    );

    const result = await syncJiraIssues(
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
        sourceSystem: "jira",
        issuesIngested: result.ingested,
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
        sourceSystem: "jira",
        trigger: "manual",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      error: describeActionError(error, "Failed to sync Jira."),
      syncedCount: null,
    };
  }
}
