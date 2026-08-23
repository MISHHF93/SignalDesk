"use server";

import {
  createDatabasePool,
  getZendeskIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshZendeskAccessToken,
  syncZendeskTickets,
} from "../_lib/sync-zendesk";

export interface SyncZendeskState {
  readonly error: string | null;
  readonly syncedCount: number | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * "Sync Now" — re-runs the same real ticket fetch/ingest logic the OAuth
 * callback's initial sync uses (`syncZendeskTickets`), refreshing the
 * stored access token first (Zendesk tokens last 1 hour, mirroring
 * Jira's/QuickBooks' own refresh cadence).
 */
export async function syncZendeskAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: SyncZendeskState,
): Promise<SyncZendeskState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to sync Zendesk.", syncedCount: null };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `zendesk-sync:${session.organizationId}`,
    1,
    5 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before syncing again.`,
      syncedCount: null,
    };
  }

  const integration = await getZendeskIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Zendesk is not currently connected.", syncedCount: null };
  }

  try {
    const accessToken = await ensureFreshZendeskAccessToken(
      getPool(),
      session.organizationId,
      integration.id,
      integration.externalAccountId,
    );

    const result = await syncZendeskTickets(
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
        sourceSystem: "zendesk",
        ticketsIngested: result.ingested,
        skipped: result.skipped,
        trigger: "manual",
      },
    });

    return { error: null, syncedCount: result.ingested };
  } catch (error) {
    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.failed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "failed",
      metadata: {
        sourceSystem: "zendesk",
        trigger: "manual",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      error: describeActionError(error, "Failed to sync Zendesk."),
      syncedCount: null,
    };
  }
}
