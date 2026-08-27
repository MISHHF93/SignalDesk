import {
  detectZendeskTicketDefaultedFields,
  fetchZendeskTickets,
  mapZendeskTicketToSourceSupportTicketRecord,
  refreshZendeskAccessToken,
  type ZendeskTicket,
} from "@signaldesk/integrations/zendesk";
import {
  completeSyncJob,
  failSyncJob,
  getZendeskTokens,
  ingestZendeskTicket,
  listRecentSyncJobsForConnection,
  startSyncJob,
  storeZendeskTokens,
  withAdvisoryLock,
  type DatabasePool,
  type SyncJobTrigger,
} from "@signaldesk/persistence";
import { parseSourceSupportTicketRecord } from "@signaldesk/schemas";

import { errorReporter } from "./error-reporter";
import { logger } from "./logger";
import { getZendeskClientCredentials } from "./zendesk-config";

// Mirrors the Jira/Asana sync's own stopgap — bounds a single synchronous
// sync run (the cursor endpoint's own real 10 req/min rate limit, see
// @signaldesk/integrations/zendesk's client.ts, is the actual reason this
// stays modest even though per_page can go up to 1,000).
const MAX_TICKET_PAGES = 20;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_LOCK_MAX_ATTEMPTS = 5;
const TOKEN_REFRESH_LOCK_RETRY_DELAY_MS = 300;

export interface ZendeskSyncResult {
  readonly ingested: number;
  readonly skipped: number;
  /** Tickets whose `requester_id`/`assignee_id` didn't resolve to a real
   * side-loaded user and fell back to a placeholder
   * (`detectZendeskTicketDefaultedFields`) — mirrors `sync-hubspot.ts`'s
   * own `defaultedNameCount`: logged for visibility, deliberately never
   * folded into `skipped`, since the record still ingested successfully. */
  readonly defaultedNameCount: number;
}

/**
 * Returns a valid access token for this integration, refreshing and
 * re-persisting it first if it's expired or expiring within 5 minutes.
 * Zendesk access tokens last only 1 hour and rotate the refresh token on
 * every use — both the new access and refresh tokens must be persisted
 * together, the same real behavior Jira's own refresh already handles.
 *
 * Real gap found by review: this used to read-check-refresh-store with no
 * locking at all — the exact race already fixed for QuickBooks/Xero/Jira
 * (`ensureFreshXeroAccessToken`, `sync-xero.ts`). Zendesk's own
 * `client.ts` explicitly documents that it rotates the refresh token on
 * every use, so two concurrent callers (a scheduled sync and a manual
 * "Sync Now") reading the same near-expiry token could both call
 * `refreshZendeskAccessToken` with it — only one succeeds, the other gets
 * a genuine `invalid_grant` instead of retrying cleanly. Fixed with the
 * same `withAdvisoryLock`-backed retry shape as Xero.
 */
export async function ensureFreshZendeskAccessToken(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  subdomain: string,
  attempt = 0,
): Promise<string> {
  const tokens = await getZendeskTokens(pool, organizationId, integrationId);

  if (!tokens) {
    throw new Error("No stored Zendesk tokens for this integration.");
  }

  if (tokens.expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }

  const refreshedAccessToken = await withAdvisoryLock(
    pool,
    `zendesk-token-refresh:${integrationId}`,
    async (): Promise<string> => {
      // Re-read inside the lock — a concurrent caller may have already
      // refreshed and stored a fresh token while we were waiting to
      // acquire it.
      const currentTokens =
        (await getZendeskTokens(pool, organizationId, integrationId)) ?? tokens;

      if (
        currentTokens.expiresAt.getTime() - Date.now() >
        TOKEN_REFRESH_BUFFER_MS
      ) {
        return currentTokens.accessToken;
      }

      const config = { ...getZendeskClientCredentials(), subdomain };
      const refreshed = await refreshZendeskAccessToken(
        config,
        currentTokens.refreshToken,
      );

      await storeZendeskTokens(pool, organizationId, integrationId, {
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
      "Could not refresh the Zendesk access token — another refresh for this connection was already in progress.",
    );
  }

  await new Promise((resolve) =>
    setTimeout(resolve, TOKEN_REFRESH_LOCK_RETRY_DELAY_MS),
  );

  return ensureFreshZendeskAccessToken(
    pool,
    organizationId,
    integrationId,
    subdomain,
    attempt + 1,
  );
}

/**
 * Fetches and ingests tickets via the real cursor-based incremental
 * export endpoint, up to `MAX_TICKET_PAGES` pages. Shared by the OAuth
 * callback's initial sync and "Sync Now" so the two can never silently
 * drift into different behavior — mirrors `syncJiraIssues`'s shape, minus
 * the two-request-shape distinction: one endpoint serves both the initial
 * pull (`start_time = 0`, matching the majority "pull everything" pattern
 * HubSpot/Salesforce/Xero/QuickBooks/Jira already established — a
 * ticket is structured data, not raw content, so Gmail's 30-day
 * content-volume bound doesn't apply here) and every incremental run
 * (real `cursor`, the previous run's own `sync_jobs.cursorAfter`).
 */
export async function syncZendeskTickets(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  accessToken: string,
  subdomain: string,
  trigger: SyncJobTrigger,
): Promise<ZendeskSyncResult> {
  const now = new Date();
  const [previousJob] = await listRecentSyncJobsForConnection(
    pool,
    organizationId,
    integrationId,
    1,
    "support_ticket",
    true,
  );
  const cursorBefore = previousJob?.cursorAfter ?? null;
  const job = await startSyncJob(
    pool,
    organizationId,
    integrationId,
    "zendesk",
    "support_ticket",
    trigger,
    cursorBefore,
  );

  let ingested = 0;
  let skipped = 0;
  let defaultedNameCount = 0;
  let cursor: string | null = cursorBefore;

  try {
    for (let page = 0; page < MAX_TICKET_PAGES; page += 1) {
      const ticketPage = await fetchZendeskTickets(
        subdomain,
        accessToken,
        0,
        cursor,
      );

      for (const rawTicket of ticketPage.tickets as readonly ZendeskTicket[]) {
        const mapped = mapZendeskTicketToSourceSupportTicketRecord(
          rawTicket,
          ticketPage.users,
          now,
        );

        if (
          detectZendeskTicketDefaultedFields(rawTicket, ticketPage.users)
            .length > 0
        ) {
          defaultedNameCount += 1;
        }

        let ticketRecord: ReturnType<typeof parseSourceSupportTicketRecord>;

        try {
          ticketRecord = parseSourceSupportTicketRecord(mapped, {
            organizationId,
            integrationId,
          });
        } catch (validationError) {
          errorReporter.captureException(validationError, {
            operation: "sync_zendesk.ticket_validation",
            connectorSlug: "zendesk",
            organizationId,
            correlationId: integrationId,
          });
          skipped += 1;
          continue;
        }

        const result = await ingestZendeskTicket(
          pool,
          organizationId,
          integrationId,
          {
            externalRecordId: ticketRecord.source.externalRecordId,
            sourceVersion: ticketRecord.source.sourceVersion,
            rawPayloadSha256: ticketRecord.source.recordDigestSha256,
            rawPayloadByteLength: JSON.stringify(rawTicket).length,
            observedAt: now,
            subject: ticketRecord.subject,
            status: ticketRecord.status,
            priority: ticketRecord.priority,
            requesterName: ticketRecord.requesterName,
            assigneeName: ticketRecord.assigneeName,
            dueAt: ticketRecord.dueAt,
            lastActivityAt: ticketRecord.lastActivityAt,
            syncJobId: job.id,
          },
        );

        if (result.inserted) {
          ingested += 1;
        }
      }

      cursor = ticketPage.afterCursor;

      if (ticketPage.endOfStream || !ticketPage.afterCursor) {
        break;
      }
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
    cursorAfter: cursor,
  });

  if (skipped > 0) {
    logger.log(
      "warn",
      `Zendesk sync: skipped ${skipped} ticket(s) that failed validation.`,
      {
        operation: "sync_zendesk.ticket_summary",
        connectorSlug: "zendesk",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  if (defaultedNameCount > 0) {
    logger.log(
      "warn",
      `Zendesk sync: ${defaultedNameCount} ticket(s) had an unresolvable requester/assignee and fell back to a placeholder.`,
      {
        operation: "sync_zendesk.ticket_defaulted_name",
        connectorSlug: "zendesk",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  return { ingested, skipped, defaultedNameCount };
}
