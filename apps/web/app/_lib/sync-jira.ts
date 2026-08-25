import {
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
  startSyncJob,
  storeJiraTokens,
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

export interface JiraSyncResult {
  readonly ingested: number;
  readonly skipped: number;
}

/**
 * Returns a valid access token for this integration, refreshing and
 * re-persisting it first if it's expired or expiring within 5 minutes.
 * Jira access tokens last only 1 hour, and Atlassian rotates the refresh
 * token on every use — both the new access and refresh tokens must be
 * persisted together, the same real behavior QuickBooks' own refresh
 * already handles.
 */
export async function ensureFreshJiraAccessToken(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<string> {
  const tokens = await getJiraTokens(pool, organizationId, integrationId);

  if (!tokens) {
    throw new Error("No stored Jira tokens for this integration.");
  }

  if (tokens.expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }

  const config = getJiraClientCredentials();
  const refreshed = await refreshJiraAccessToken(config, tokens.refreshToken);

  await storeJiraTokens(pool, organizationId, integrationId, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
  });

  return refreshed.accessToken;
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
 * `AND updated > "<jql-date-literal>"` to the same query.
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
          continue;
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

  return { ingested, skipped };
}
