"use server";

import {
  createDatabasePool,
  getOrganizationBusinessProfile,
  getSalesforceIntegrationStatus,
  getSalesforceTokens,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getRequestOrigin } from "../_lib/request-origin";
import { getCurrentOrganization } from "../_lib/session";
import { syncSalesforceOpportunities } from "../_lib/sync-salesforce";

export interface SyncSalesforceState {
  readonly error: string | null;
  readonly syncedCount: number | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * "Sync Now" — re-runs the same real opportunity fetch/ingest logic the
 * OAuth callback's initial sync uses (`syncSalesforceOpportunities`,
 * extracted so the two can't drift). Unlike HubSpot's action, there is no
 * separate "ensure fresh token" step — Salesforce's OAuth response
 * discloses no token lifetime to check against, so the sync function
 * itself reactively refreshes only if the stored access token turns out
 * to be expired (a real `SalesforceSessionExpiredError`), not on every
 * call. Real sync, not a fake button: same mapper, same validation, same
 * idempotent ingest.
 */
export async function syncSalesforceAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: SyncSalesforceState,
): Promise<SyncSalesforceState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to sync Salesforce.", syncedCount: null };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `salesforce-sync:${session.organizationId}`,
    1,
    5 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before syncing again.`,
      syncedCount: null,
    };
  }

  const integration = await getSalesforceIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return {
      error: "Salesforce is not currently connected.",
      syncedCount: null,
    };
  }

  try {
    const tokens = await getSalesforceTokens(
      getPool(),
      session.organizationId,
      integration.id,
    );

    if (!tokens) {
      return {
        error: "No stored Salesforce tokens for this integration.",
        syncedCount: null,
      };
    }

    const origin = await getRequestOrigin();
    const businessProfile = await getOrganizationBusinessProfile(
      getPool(),
      session.organizationId,
    );

    const { ingested, skipped, defaultedNameCount } =
      await syncSalesforceOpportunities(
        getPool(),
        session.organizationId,
        integration.id,
        origin,
        integration.externalAccountId,
        tokens.accessToken,
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
        sourceSystem: "salesforce",
        opportunitiesIngested: ingested,
        skipped,
        defaultedNameCount,
        trigger: "manual",
      },
    });

    return { error: null, syncedCount: ingested };
  } catch (error) {
    // See sync-hubspot.ts's own catch block for why a token-refresh
    // failure and a sync failure share one audit bucket here.
    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.failed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "failed",
      metadata: {
        sourceSystem: "salesforce",
        trigger: "manual",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      error: describeActionError(error, "Failed to sync Salesforce."),
      syncedCount: null,
    };
  }
}
