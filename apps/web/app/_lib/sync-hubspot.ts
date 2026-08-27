import {
  detectHubSpotDealDefaultedFields,
  fetchHubSpotDeals,
  fetchHubSpotDealsModifiedSince,
  fetchHubSpotOwners,
  mapHubSpotDealToSourceLeadRecord,
  refreshHubSpotAccessToken,
  type HubSpotDeal,
} from "@signaldesk/integrations/hubspot";
import {
  completeSyncJob,
  failSyncJob,
  getHubSpotTokens,
  ingestHubSpotDeal,
  listRecentSyncJobsForConnection,
  startSyncJob,
  storeHubSpotTokens,
  withAdvisoryLock,
  type DatabasePool,
  type SyncJobTrigger,
} from "@signaldesk/persistence";
import { parseSourceLeadRecord } from "@signaldesk/schemas";

import { errorReporter } from "./error-reporter";
import { getHubSpotOAuthConfig } from "./hubspot-config";
import { logger } from "./logger";

// Mirrors the OAuth callback's own stopgap (see that route's doc comment)
// — bounds a single synchronous sync run, not the account's real deal
// count.
const MAX_DEAL_PAGES = 20;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_LOCK_MAX_ATTEMPTS = 5;
const TOKEN_REFRESH_LOCK_RETRY_DELAY_MS = 300;

export interface HubSpotSyncResult {
  readonly ingested: number;
  readonly skipped: number;
  /**
   * Real HubSpot deals ingested this run that had no usable `dealname` and
   * fell back to a placeholder — distinct from `skipped` (a record never
   * ingested at all). Every real deal has a name, so this is a genuine
   * schema-drift signal callers should surface, not routine data absence
   * (issue 5, `docs/25-issue-audit.md`: "Integration Schema Drift").
   */
  readonly defaultedNameCount: number;
}

/**
 * Returns a valid access token for this integration, refreshing and
 * re-persisting it first if it's expired or expiring within 5 minutes.
 * The OAuth callback never needs this (it always has a freshly-exchanged
 * token) — this exists for "Sync Now", which runs long after connect.
 *
 * Real gap found by review: this used to read-check-refresh-store with no
 * locking at all — the exact race already fixed for QuickBooks/Xero/Jira/
 * Zendesk (`ensureFreshXeroAccessToken`, `sync-xero.ts`). HubSpot's own
 * developer documentation confirms a refresh call "potentially" returns a
 * new refresh token and explicitly recommends locking around refreshes for
 * this reason — so two concurrent callers (a scheduled sync and a manual
 * "Sync Now") reading the same near-expiry token could both call
 * `refreshHubSpotAccessToken` with it, and if HubSpot happens to rotate on
 * that call, only one succeeds. Fixed with the same
 * `withAdvisoryLock`-backed retry shape as Xero.
 */
export async function ensureFreshHubSpotAccessToken(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  origin: string,
  attempt = 0,
): Promise<string> {
  const tokens = await getHubSpotTokens(pool, organizationId, integrationId);

  if (!tokens) {
    throw new Error("No stored HubSpot tokens for this integration.");
  }

  if (tokens.expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }

  const refreshedAccessToken = await withAdvisoryLock(
    pool,
    `hubspot-token-refresh:${integrationId}`,
    async (): Promise<string> => {
      // Re-read inside the lock — a concurrent caller may have already
      // refreshed and stored a fresh token while we were waiting to
      // acquire it.
      const currentTokens =
        (await getHubSpotTokens(pool, organizationId, integrationId)) ?? tokens;

      if (
        currentTokens.expiresAt.getTime() - Date.now() >
        TOKEN_REFRESH_BUFFER_MS
      ) {
        return currentTokens.accessToken;
      }

      const config = getHubSpotOAuthConfig(origin);
      const refreshed = await refreshHubSpotAccessToken(
        config,
        currentTokens.refreshToken,
      );

      await storeHubSpotTokens(pool, organizationId, integrationId, {
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
      "Could not refresh the HubSpot access token — another refresh for this connection was already in progress.",
    );
  }

  await new Promise((resolve) =>
    setTimeout(resolve, TOKEN_REFRESH_LOCK_RETRY_DELAY_MS),
  );

  return ensureFreshHubSpotAccessToken(
    pool,
    organizationId,
    integrationId,
    origin,
    attempt + 1,
  );
}

/**
 * Fetches and ingests HubSpot deals, up to `MAX_DEAL_PAGES` pages. Shared
 * by the OAuth callback's initial sync and the "Sync Now" action so the
 * two can never silently drift into different behavior. Wraps the run in
 * a real `sync_jobs` row (`entityType: "lead"`, ADR 0021/0023): an
 * initial sync (no prior cursor) pulls the full deal set via the plain
 * list endpoint, same as before; an incremental run (a stored
 * `cursorBefore`) switches to `fetchHubSpotDealsModifiedSince`, HubSpot's
 * Search API filtered by `hs_lastmodifieddate > cursorBefore`
 * (`incrementalSyncImplemented: true`, ADR 0023) — either way, the newest
 * `hs_lastmodifieddate` seen this run is computed and stored as the next
 * cursor.
 */
export async function syncHubSpotDeals(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  accessToken: string,
  expectedResponseHours: number,
  trigger: SyncJobTrigger,
): Promise<HubSpotSyncResult> {
  const owners = await fetchHubSpotOwners(accessToken);
  const ownerNamesById = new Map(
    owners.map((owner) => [
      owner.id,
      [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
        owner.email ||
        owner.id,
    ]),
  );

  const now = new Date();
  const [previousJob] = await listRecentSyncJobsForConnection(
    pool,
    organizationId,
    integrationId,
    1,
    "lead",
    true,
  );
  const cursorBefore = previousJob?.cursorAfter ?? null;
  const job = await startSyncJob(
    pool,
    organizationId,
    integrationId,
    "hubspot",
    "lead",
    trigger,
    cursorBefore,
  );

  let ingested = 0;
  let skipped = 0;
  let defaultedNameCount = 0;
  let maxCursor: string | null = cursorBefore;
  let after: string | undefined;

  try {
    for (let page = 0; page < MAX_DEAL_PAGES; page += 1) {
      const dealsPage = cursorBefore
        ? await fetchHubSpotDealsModifiedSince(accessToken, cursorBefore, after)
        : await fetchHubSpotDeals(accessToken, after);

      for (const deal of dealsPage.results as readonly HubSpotDeal[]) {
        const seenAt = deal.properties.hs_lastmodifieddate ?? deal.updatedAt;

        if (seenAt && (!maxCursor || seenAt > maxCursor)) {
          maxCursor = seenAt;
        }

        let lead: ReturnType<typeof parseSourceLeadRecord>;

        try {
          lead = parseSourceLeadRecord(
            mapHubSpotDealToSourceLeadRecord(deal, {
              now,
              ownerNamesById,
              expectedResponseHours,
            }),
            { organizationId, integrationId },
          );
        } catch (validationError) {
          errorReporter.captureException(validationError, {
            operation: "sync_hubspot.deal_validation",
            connectorSlug: "hubspot",
            organizationId,
            correlationId: integrationId,
          });
          skipped += 1;
          continue;
        }

        if (detectHubSpotDealDefaultedFields(deal).length > 0) {
          defaultedNameCount += 1;
        }

        const result = await ingestHubSpotDeal(
          pool,
          organizationId,
          integrationId,
          {
            externalRecordId: lead.source.externalRecordId,
            sourceVersion: lead.source.sourceVersion,
            rawPayloadSha256: lead.source.recordDigestSha256,
            rawPayloadByteLength: JSON.stringify(deal).length,
            observedAt: now,
            contactName: lead.contactName,
            companyName: lead.companyName,
            stage: lead.stage,
            valueCents: lead.valueCents,
            currency: lead.currency,
            expectedResponseHours: lead.expectedResponseHours,
            sourceCreatedAt: lead.createdAt,
            lastInteractionAt: lead.lastInteractionAt,
            syncJobId: job.id,
            ownerName: lead.owner?.name ?? null,
          },
        );

        if (result.inserted) {
          ingested += 1;
        }
      }

      if (!dealsPage.nextAfter) {
        break;
      }

      after = dealsPage.nextAfter;
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
      `HubSpot sync: skipped ${skipped} deal(s) that failed validation.`,
      {
        operation: "sync_hubspot.deal_summary",
        connectorSlug: "hubspot",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  if (defaultedNameCount > 0) {
    logger.log(
      "warn",
      `HubSpot sync: ${defaultedNameCount} deal(s) had no usable dealname and fell back to a placeholder.`,
      {
        operation: "sync_hubspot.deal_defaulted_name",
        connectorSlug: "hubspot",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  return { ingested, skipped, defaultedNameCount };
}
