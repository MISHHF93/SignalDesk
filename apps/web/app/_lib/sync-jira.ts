import {
  detectJiraIssueDefaultedFields,
  fetchJiraClosedIssues,
  fetchJiraIssues,
  mapJiraIssueToSourceTaskRecord,
  refreshJiraAccessToken,
  type JiraIssue,
} from "@signaldesk/integrations/jira";
import {
  completeSyncJob,
  failSyncJob,
  getJiraTokens,
  ingestJiraIssue,
  listRecentSyncJobsForConnection,
  markTaskCompletedBySourceRecord,
  startSyncJob,
  storeJiraTokens,
  withAdvisoryLock,
  type DatabasePool,
  type SyncJobTrigger,
} from "@signaldesk/persistence";
import { parseSourceTaskRecord } from "@signaldesk/schemas";

import { errorReporter } from "./error-reporter";
import { getJiraClientCredentials } from "./jira-config";
import { logger } from "./logger";

// Mirrors the Asana sync's own stopgap (see that file's doc comment) —
// bounds a single synchronous sync run, not the site's real issue count.
const MAX_ISSUE_PAGES = 20;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_LOCK_MAX_ATTEMPTS = 5;
const TOKEN_REFRESH_LOCK_RETRY_DELAY_MS = 300;

export interface JiraSyncResult {
  readonly ingested: number;
  readonly skipped: number;
  /** Issues whose assignee had a real, non-null account but a redacted
   * `displayName` and fell back to a placeholder
   * (`detectJiraIssueDefaultedFields`) — mirrors `sync-asana.ts`'s own
   * `defaultedNameCount`: logged for visibility, deliberately never folded
   * into `skipped`, since the record still ingested successfully. */
  readonly defaultedNameCount: number;
  /** Tasks observed as closed (`statusCategory = Done`) since the
   * previous cursor and transitioned to `completed: true` — always 0 on
   * an initial sync (nothing has been observed as open yet to
   * transition), mirroring `XeroSyncResult.closed`/
   * `QuickBooksSyncResult.closed` exactly. */
  readonly closed: number;
}

/**
 * Returns a valid access token for this integration, refreshing and
 * re-persisting it first if it's expired or expiring within 5 minutes.
 * Jira access tokens last only 1 hour, and Atlassian rotates the refresh
 * token on every use — both the new access and refresh tokens must be
 * persisted together, the same real behavior QuickBooks' own refresh
 * already handles.
 *
 * Real gap found by review: this used to read-check-refresh-store with no
 * locking at all — the exact race already fixed for QuickBooks
 * (`ensureFreshQuickBooksAccessToken`, `sync-quickbooks.ts`). Two
 * concurrent callers for the same integration could both read the same
 * near-expiry token and both call `refreshJiraAccessToken` with it —
 * since Atlassian rotates the refresh token on every use, only one call
 * can actually succeed; the other gets a genuine `invalid_grant`
 * rejection instead of retrying cleanly. Fixed with the same
 * `withAdvisoryLock`-backed retry shape as QuickBooks.
 */
export async function ensureFreshJiraAccessToken(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  attempt = 0,
): Promise<string> {
  const tokens = await getJiraTokens(pool, organizationId, integrationId);

  if (!tokens) {
    throw new Error("No stored Jira tokens for this integration.");
  }

  if (tokens.expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }

  const refreshedAccessToken = await withAdvisoryLock(
    pool,
    `jira-token-refresh:${integrationId}`,
    async (): Promise<string> => {
      // Re-read inside the lock — a concurrent caller may have already
      // refreshed and stored a fresh token while we were waiting to
      // acquire it.
      const currentTokens =
        (await getJiraTokens(pool, organizationId, integrationId)) ?? tokens;

      if (
        currentTokens.expiresAt.getTime() - Date.now() >
        TOKEN_REFRESH_BUFFER_MS
      ) {
        return currentTokens.accessToken;
      }

      const config = getJiraClientCredentials();
      const refreshed = await refreshJiraAccessToken(
        config,
        currentTokens.refreshToken,
      );

      await storeJiraTokens(pool, organizationId, integrationId, {
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
      "Could not refresh the Jira access token — another refresh for this connection was already in progress.",
    );
  }

  await new Promise((resolve) =>
    setTimeout(resolve, TOKEN_REFRESH_LOCK_RETRY_DELAY_MS),
  );

  return ensureFreshJiraAccessToken(
    pool,
    organizationId,
    integrationId,
    attempt + 1,
  );
}

/**
 * Fetches and ingests every open (`statusCategory != Done`) Jira issue,
 * up to `MAX_ISSUE_PAGES` pages. Shared by the OAuth callback's initial
 * sync and "Sync Now" so the two can never silently drift into different
 * behavior — mirrors `syncAsanaTasks`'s shape, minus the per-workspace
 * loop (a Jira site has no workspace-scoping concept the way Asana does;
 * one `cloudId` is the whole real query scope). Wraps the run in a real
 * `sync_jobs` row (`entityType: "task"`): an initial sync (no prior
 * cursor) pulls every open issue; an incremental run adds
 * `AND updated >= "<jql-date-literal>"` to the same query.
 *
 * Real gap found by review: `statusCategory != Done` is a hard exclusion
 * with no way to compose "OR recently closed" without an unbounded
 * full-site refetch — a Jira issue that closes was invisible to every
 * future incremental fetch, so it stayed `completed: false` in this app
 * forever, surfacing indefinitely in `listOverdueTasks` as stuck work
 * that was actually finished. Fixed the same way Xero/QuickBooks' own
 * closed-invoice case was: on an incremental run (a non-null
 * `cursorBefore`), a second pass fetches issues that reached
 * `statusCategory = Done` since that cursor
 * (`fetchJiraClosedIssues`) and transitions each to `completed: true`
 * via `markTaskCompletedBySourceRecord` — an initial sync (no prior
 * cursor) skips this pass, since nothing has been observed as open yet
 * to transition.
 */
export async function syncJiraIssues(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  accessToken: string,
  cloudId: string,
  trigger: SyncJobTrigger,
): Promise<JiraSyncResult> {
  const now = new Date();
  const [previousJob] = await listRecentSyncJobsForConnection(
    pool,
    organizationId,
    integrationId,
    1,
    "task",
  );
  const cursorBefore = previousJob?.cursorAfter ?? null;
  const job = await startSyncJob(
    pool,
    organizationId,
    integrationId,
    "jira",
    "task",
    trigger,
    cursorBefore,
  );

  let ingested = 0;
  let skipped = 0;
  let defaultedNameCount = 0;
  let closed = 0;
  let maxCursor: string | null = cursorBefore;
  let pageToken: string | null = null;

  try {
    for (let page = 0; page < MAX_ISSUE_PAGES; page += 1) {
      const issuePage = await fetchJiraIssues(
        accessToken,
        cloudId,
        cursorBefore,
        pageToken,
      );

      for (const rawIssue of issuePage.issues as readonly JiraIssue[]) {
        if (!maxCursor || rawIssue.fields.updated > maxCursor) {
          maxCursor = rawIssue.fields.updated;
        }

        const mapped = mapJiraIssueToSourceTaskRecord(rawIssue, now);

        if (mapped === null) {
          // Not a sync failure — a real issue with no due date set in
          // Jira. Logged (not counted in `skipped`) so it doesn't fold
          // into `completeSyncJob`'s `itemsSkipped > 0` check and wrongly
          // mark a perfectly healthy connection "degraded" — mirrors
          // sync-asana.ts's/sync-quickbooks.ts's identical case, which
          // this function was missing.
          logger.log(
            "info",
            `Jira issue ${rawIssue.key} has no due date; not ingested.`,
            {
              operation: "sync_jira.issue_no_due_date",
              connectorSlug: "jira",
              organizationId,
              correlationId: integrationId,
            },
          );
          continue;
        }

        if (detectJiraIssueDefaultedFields(rawIssue).length > 0) {
          defaultedNameCount += 1;
        }

        let taskRecord: ReturnType<typeof parseSourceTaskRecord>;

        try {
          taskRecord = parseSourceTaskRecord(mapped, {
            organizationId,
            integrationId,
          });
        } catch (validationError) {
          errorReporter.captureException(validationError, {
            operation: "sync_jira.issue_validation",
            connectorSlug: "jira",
            organizationId,
            correlationId: integrationId,
          });
          skipped += 1;
          continue;
        }

        const result = await ingestJiraIssue(
          pool,
          organizationId,
          integrationId,
          {
            externalRecordId: taskRecord.source.externalRecordId,
            sourceVersion: taskRecord.source.sourceVersion,
            rawPayloadSha256: taskRecord.source.recordDigestSha256,
            rawPayloadByteLength: JSON.stringify(rawIssue).length,
            observedAt: now,
            name: taskRecord.name,
            assigneeName: taskRecord.assigneeName,
            dueAt: taskRecord.dueAt,
            completed: taskRecord.completed,
            syncJobId: job.id,
          },
        );

        if (result.inserted) {
          ingested += 1;
        }
      }

      if (!issuePage.nextPageToken) {
        break;
      }

      pageToken = issuePage.nextPageToken;
    }

    if (cursorBefore) {
      let closedPageToken: string | null = null;

      for (let page = 0; page < MAX_ISSUE_PAGES; page += 1) {
        const closedPage = await fetchJiraClosedIssues(
          accessToken,
          cloudId,
          cursorBefore,
          closedPageToken,
        );

        for (const rawIssue of closedPage.issues as readonly JiraIssue[]) {
          if (!maxCursor || rawIssue.fields.updated > maxCursor) {
            maxCursor = rawIssue.fields.updated;
          }

          const wasUpdated = await markTaskCompletedBySourceRecord(
            pool,
            organizationId,
            "jira",
            rawIssue.id,
          );

          if (wasUpdated) {
            closed += 1;
          }
        }

        if (!closedPage.nextPageToken) {
          break;
        }

        closedPageToken = closedPage.nextPageToken;
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
    cursorAfter: maxCursor,
  });

  if (skipped > 0) {
    logger.log(
      "warn",
      `Jira sync: skipped ${skipped} issue(s) that failed validation.`,
      {
        operation: "sync_jira.issue_summary",
        connectorSlug: "jira",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  if (defaultedNameCount > 0) {
    logger.log(
      "warn",
      `Jira sync: ${defaultedNameCount} issue(s) had a redacted assignee name and fell back to a placeholder.`,
      {
        operation: "sync_jira.issue_defaulted_name",
        connectorSlug: "jira",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  return { ingested, skipped, defaultedNameCount, closed };
}
