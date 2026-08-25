import {
  detectSalesforceOpportunityDefaultedFields,
  fetchSalesforceOpportunities,
  fetchSalesforceOpportunitiesPage,
  mapSalesforceOpportunityToSourceLeadRecord,
  refreshSalesforceAccessToken,
  SalesforceSessionExpiredError,
  type SalesforceOpportunity,
  type SalesforceOpportunityPage,
} from "@signaldesk/integrations/salesforce";
import {
  completeSyncJob,
  failSyncJob,
  getSalesforceTokens,
  ingestSalesforceOpportunity,
  listRecentSyncJobsForConnection,
  startSyncJob,
  storeSalesforceTokens,
  type DatabasePool,
  type SyncJobTrigger,
} from "@signaldesk/persistence";
import { parseSourceLeadRecord } from "@signaldesk/schemas";

import { errorReporter } from "./error-reporter";
import { logger } from "./logger";
import { getSalesforceOAuthConfig } from "./salesforce-config";

// Mirrors the HubSpot OAuth callback's own stopgap (see that route's doc
// comment) — bounds a single synchronous sync run, not the org's real
// opportunity count.
const MAX_OPPORTUNITY_PAGES = 20;

export interface SalesforceSyncResult {
  readonly ingested: number;
  readonly skipped: number;
  /** Real Salesforce opportunities ingested this run that had no usable
   * `Name` and fell back to a placeholder — same "genuine schema-drift
   * signal" distinction `HubSpotSyncResult.defaultedNameCount` makes
   * (issue 5, `docs/25-issue-audit.md`). */
  readonly defaultedNameCount: number;
}

/**
 * Refreshes the stored access token unconditionally and re-persists it —
 * unlike `ensureFreshHubSpotAccessToken`, there's no stored `expiresAt` to
 * check against (Salesforce's OAuth response never discloses a token
 * lifetime; see `SalesforceTokenResponse`'s doc comment). Used only to
 * recover after a real `SalesforceSessionExpiredError`, not called
 * proactively before every sync — Salesforce sessions commonly last hours
 * to a full day, so refreshing on every "Sync Now" click would be
 * wasteful for no real benefit.
 */
async function refreshAndPersistSalesforceToken(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  origin: string,
  refreshToken: string,
): Promise<string> {
  const config = getSalesforceOAuthConfig(origin);
  const refreshed = await refreshSalesforceAccessToken(config, refreshToken);

  await storeSalesforceTokens(pool, organizationId, integrationId, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
  });

  return refreshed.accessToken;
}

async function fetchPageWithSessionRecovery(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  origin: string,
  instanceUrl: string,
  accessToken: string,
  fetchPage: (accessToken: string) => Promise<SalesforceOpportunityPage>,
): Promise<{
  readonly page: SalesforceOpportunityPage;
  readonly accessToken: string;
}> {
  try {
    return { page: await fetchPage(accessToken), accessToken };
  } catch (error) {
    if (!(error instanceof SalesforceSessionExpiredError)) {
      throw error;
    }

    const tokens = await getSalesforceTokens(
      pool,
      organizationId,
      integrationId,
    );

    if (!tokens) {
      throw error;
    }

    const refreshedAccessToken = await refreshAndPersistSalesforceToken(
      pool,
      organizationId,
      integrationId,
      origin,
      tokens.refreshToken,
    );

    return {
      page: await fetchPage(refreshedAccessToken),
      accessToken: refreshedAccessToken,
    };
  }
}

/**
 * Fetches and ingests Salesforce opportunities, up to `MAX_OPPORTUNITY_
 * PAGES` pages. Shared by the OAuth callback's initial sync and the "Sync
 * Now" action so the two can never silently drift into different
 * behavior — mirrors `syncHubSpotDeals`'s exact shape. Wraps the run in a
 * real `sync_jobs` row (`entityType: "lead"`): an initial sync (no prior
 * cursor) pulls every opportunity via the plain query; an incremental run
 * (a stored `cursorAfter`) adds `WHERE LastModifiedDate > cursorAfter` to
 * the same query — either way, the newest `LastModifiedDate` seen this
 * run is computed and stored as the next cursor.
 */
export async function syncSalesforceOpportunities(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  origin: string,
  instanceUrl: string,
  initialAccessToken: string,
  expectedResponseHours: number,
  trigger: SyncJobTrigger,
): Promise<SalesforceSyncResult> {
  const now = new Date();
  const [previousJob] = await listRecentSyncJobsForConnection(
    pool,
    organizationId,
    integrationId,
    1,
    "lead",
  );
  const cursorBefore = previousJob?.cursorAfter ?? null;
  const job = await startSyncJob(
    pool,
    organizationId,
    integrationId,
    "salesforce",
    "lead",
    trigger,
    cursorBefore,
  );

  let ingested = 0;
  let skipped = 0;
  let defaultedNameCount = 0;
  let maxCursor: string | null = cursorBefore;
  let accessToken = initialAccessToken;
  let nextRecordsUrl: string | null = null;

  try {
    for (let page = 0; page < MAX_OPPORTUNITY_PAGES; page += 1) {
      const result = await fetchPageWithSessionRecovery(
        pool,
        organizationId,
        integrationId,
        origin,
        instanceUrl,
        accessToken,
        (token) =>
          nextRecordsUrl
            ? fetchSalesforceOpportunitiesPage(
                instanceUrl,
                token,
                nextRecordsUrl!,
              )
            : fetchSalesforceOpportunities(
                instanceUrl,
                token,
                cursorBefore ?? undefined,
              ),
      );

      accessToken = result.accessToken;

      for (const opportunity of result.page
        .records as readonly SalesforceOpportunity[]) {
        if (!maxCursor || opportunity.LastModifiedDate > maxCursor) {
          maxCursor = opportunity.LastModifiedDate;
        }

        let lead: ReturnType<typeof parseSourceLeadRecord>;

        try {
          lead = parseSourceLeadRecord(
            mapSalesforceOpportunityToSourceLeadRecord(opportunity, {
              now,
              expectedResponseHours,
            }),
            { organizationId, integrationId },
          );
        } catch (validationError) {
          errorReporter.captureException(validationError, {
            operation: "sync_salesforce.opportunity_validation",
            connectorSlug: "salesforce",
            organizationId,
            correlationId: integrationId,
          });
          skipped += 1;
          continue;
        }

        if (
          detectSalesforceOpportunityDefaultedFields(opportunity).length > 0
        ) {
          defaultedNameCount += 1;
        }

        const ingestResult = await ingestSalesforceOpportunity(
          pool,
          organizationId,
          integrationId,
          {
            externalRecordId: lead.source.externalRecordId,
            sourceVersion: lead.source.sourceVersion,
            rawPayloadSha256: lead.source.recordDigestSha256,
            rawPayloadByteLength: JSON.stringify(opportunity).length,
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

        if (ingestResult.inserted) {
          ingested += 1;
        }
      }

      if (!result.page.nextRecordsUrl) {
        break;
      }

      nextRecordsUrl = result.page.nextRecordsUrl;
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
      `Salesforce sync: skipped ${skipped} opportunity(ies) that failed validation.`,
      {
        operation: "sync_salesforce.opportunity_summary",
        connectorSlug: "salesforce",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  if (defaultedNameCount > 0) {
    logger.log(
      "warn",
      `Salesforce sync: ${defaultedNameCount} opportunity(ies) had no usable Name and fell back to a placeholder.`,
      {
        operation: "sync_salesforce.opportunity_defaulted_name",
        connectorSlug: "salesforce",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  return { ingested, skipped, defaultedNameCount };
}
