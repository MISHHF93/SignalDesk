"use server";

import {
  createDatabasePool,
  getGmailIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getRequestOrigin } from "../_lib/request-origin";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshGmailAccessToken,
  syncGmailMessages,
} from "../_lib/sync-gmail";

export interface SyncGmailState {
  readonly error: string | null;
  readonly syncedCount: number | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * "Sync Now" for Gmail (Phase 4b, implementation roadmap) — re-runs the
 * same real message fetch/ingest logic the OAuth callback's initial sync
 * uses (`syncGmailMessages`, extracted so the two can't drift), refreshing
 * the stored access token first if needed. Mirrors `syncHubSpotAction`
 * exactly.
 */
export async function syncGmailAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: SyncGmailState,
): Promise<SyncGmailState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to sync Gmail.", syncedCount: null };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `gmail-sync:${session.organizationId}`,
    1,
    5 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before syncing again.`,
      syncedCount: null,
    };
  }

  const integration = await getGmailIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Gmail is not currently connected.", syncedCount: null };
  }

  if (!integration.externalAccountLabel) {
    // Real, disclosed edge case: direction/internal-correspondence
    // filtering both need the connected account's own address (see
    // mapGmailMessageToSourceMessageRecord's doc comment) — without it,
    // syncing would mean guessing, which this app doesn't do.
    return {
      error:
        "This Gmail connection has no recorded account address — reconnect Gmail to sync.",
      syncedCount: null,
    };
  }

  try {
    const origin = await getRequestOrigin();
    const accessToken = await ensureFreshGmailAccessToken(
      getPool(),
      session.organizationId,
      integration.id,
      origin,
    );

    const { ingested, filtered, skipped } = await syncGmailMessages(
      getPool(),
      session.organizationId,
      integration.id,
      accessToken,
      integration.externalAccountLabel,
      "manual",
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.completed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: {
        sourceSystem: "gmail",
        messagesIngested: ingested,
        filtered,
        skipped,
        trigger: "manual",
      },
    });

    return { error: null, syncedCount: ingested };
  } catch (error) {
    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.failed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "failed",
      metadata: {
        sourceSystem: "gmail",
        trigger: "manual",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      error: describeActionError(error, "Failed to sync Gmail."),
      syncedCount: null,
    };
  }
}
