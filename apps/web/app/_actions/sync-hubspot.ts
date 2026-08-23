"use server";

import {
  createDatabasePool,
  getHubSpotIntegrationStatus,
  getOrganizationBusinessProfile,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getRequestOrigin } from "../_lib/request-origin";
import { getCurrentOrganization } from "../_lib/session";
import {
  ensureFreshHubSpotAccessToken,
  syncHubSpotDeals,
} from "../_lib/sync-hubspot";

export interface SyncHubSpotState {
  readonly error: string | null;
  readonly syncedCount: number | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * "Sync Now" — re-runs the same real deal fetch/ingest logic the OAuth
 * callback's initial sync uses (`syncHubSpotDeals`, extracted so the two
 * can't drift), refreshing the stored access token first if needed. Real
 * sync, not a fake button: same mappers, same validation, same
 * idempotent ingest.
 */
export async function syncHubSpotAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: SyncHubSpotState,
): Promise<SyncHubSpotState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to sync HubSpot.", syncedCount: null };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `hubspot-sync:${session.organizationId}`,
    1,
    5 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before syncing again.`,
      syncedCount: null,
    };
  }

  const integration = await getHubSpotIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "HubSpot is not currently connected.", syncedCount: null };
  }

  try {
    const origin = await getRequestOrigin();
    const accessToken = await ensureFreshHubSpotAccessToken(
      getPool(),
      session.organizationId,
      integration.id,
      origin,
    );
    const businessProfile = await getOrganizationBusinessProfile(
      getPool(),
      session.organizationId,
    );

    const { ingested, skipped, defaultedNameCount } = await syncHubSpotDeals(
      getPool(),
      session.organizationId,
      integration.id,
      accessToken,
      businessProfile.defaultExpectedResponseHours,
      "manual",
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.completed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: {
        sourceSystem: "hubspot",
        dealsIngested: ingested,
        skipped,
        defaultedNameCount,
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
        sourceSystem: "hubspot",
        trigger: "manual",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      error: describeActionError(error, "Failed to sync HubSpot."),
      syncedCount: null,
    };
  }
}
