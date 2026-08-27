import {
  detectAsanaTaskDefaultedFields,
  fetchAsanaTasks,
  fetchAsanaWorkspaces,
  mapAsanaTaskToSourceTaskRecord,
  refreshAsanaAccessToken,
  type AsanaTask,
} from "@signaldesk/integrations/asana";
import {
  completeSyncJob,
  failSyncJob,
  getAsanaTokens,
  ingestAsanaTask,
  listRecentSyncJobsForConnection,
  startSyncJob,
  storeAsanaTokens,
  withAdvisoryLock,
  type DatabasePool,
  type SyncJobTrigger,
} from "@signaldesk/persistence";
import { parseSourceTaskRecord } from "@signaldesk/schemas";

import { getAsanaClientCredentials } from "./asana-config";
import { errorReporter } from "./error-reporter";
import { logger } from "./logger";

// Mirrors the OAuth callback's own per-workspace stopgap.
const MAX_TASK_PAGES_PER_WORKSPACE = 20;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_LOCK_MAX_ATTEMPTS = 5;
const TOKEN_REFRESH_LOCK_RETRY_DELAY_MS = 300;

export interface AsanaSyncResult {
  readonly ingested: number;
  readonly skipped: number;
  /** Tasks whose `name` or resolved assignee name was missing/unresolvable
   * and fell back to a placeholder (`detectAsanaTaskDefaultedFields`) —
   * mirrors `sync-hubspot.ts`'s own `defaultedNameCount`: logged for
   * visibility, deliberately never folded into `skipped`, since the
   * record still ingested successfully. */
  readonly defaultedNameCount: number;
}

/**
 * Returns a valid access token for this integration, refreshing and
 * re-persisting it first if it's expired or expiring within 5 minutes.
 * Asana access tokens last only ~1 hour, so unlike the OAuth callback
 * (always freshly exchanged), "Sync Now" needs this on nearly every call.
 *
 * Real gap found by review: this used to read-check-refresh-store with no
 * locking at all — the same unlocked shape already fixed for QuickBooks/
 * Xero/Jira/Zendesk/HubSpot (`ensureFreshXeroAccessToken`,
 * `sync-xero.ts`). Unlike those, Asana's own documentation, support forum,
 * and OAuth client SDKs never state outright whether its refresh token
 * rotates on use — this is deliberately not claimed as confirmed. But the
 * response this code already persists (`refreshed.refreshToken`) is
 * whatever value Asana's refresh endpoint returns, which structurally
 * could be a rotated value; the same `withAdvisoryLock`-backed retry shape
 * is applied here defensively, since it costs nothing when nothing is
 * actually rotating (it only serializes the rare case of two callers
 * refreshing at the same instant) and closes the race if it turns out
 * Asana does rotate.
 */
export async function ensureFreshAsanaAccessToken(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  attempt = 0,
): Promise<string> {
  const tokens = await getAsanaTokens(pool, organizationId, integrationId);

  if (!tokens) {
    throw new Error("No stored Asana tokens for this integration.");
  }

  if (tokens.expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }

  const refreshedAccessToken = await withAdvisoryLock(
    pool,
    `asana-token-refresh:${integrationId}`,
    async (): Promise<string> => {
      // Re-read inside the lock — a concurrent caller may have already
      // refreshed and stored a fresh token while we were waiting to
      // acquire it.
      const currentTokens =
        (await getAsanaTokens(pool, organizationId, integrationId)) ?? tokens;

      if (
        currentTokens.expiresAt.getTime() - Date.now() >
        TOKEN_REFRESH_BUFFER_MS
      ) {
        return currentTokens.accessToken;
      }

      const config = getAsanaClientCredentials();
      const refreshed = await refreshAsanaAccessToken(
        config,
        currentTokens.refreshToken,
      );

      await storeAsanaTokens(pool, organizationId, integrationId, {
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
      "Could not refresh the Asana access token — another refresh for this connection was already in progress.",
    );
  }

  await new Promise((resolve) =>
    setTimeout(resolve, TOKEN_REFRESH_LOCK_RETRY_DELAY_MS),
  );

  return ensureFreshAsanaAccessToken(
    pool,
    organizationId,
    integrationId,
    attempt + 1,
  );
}

/**
 * Fetches and ingests every overdue, incomplete Asana task assigned to
 * the connected user across every workspace they belong to. Shared by
 * the OAuth callback's initial sync and the "Sync Now" action. Wraps the
 * whole multi-workspace run in one real `sync_jobs` row (ADR 0021): an
 * initial sync (no prior cursor) pulls the full overdue set, same as
 * before; an incremental run (a stored `cursorAfter` from the previous
 * run) passes it as `modified_since` on every workspace's fetch
 * (`incrementalSyncImplemented: true`, ADR 0024) — either way, the newest
 * `modified_at` seen across every workspace this run is computed and
 * stored as the next cursor.
 *
 * Real gap found by review: unlike HubSpot's equivalent (which has a
 * genuinely sorted Search API to fall back on — see `sync-hubspot.ts`'s
 * own fix), Asana's `GET /tasks` has no `sort_by`/ordering parameter at
 * all, confirmed against Asana's own API reference. Advancing the cursor
 * to the *maximum* `modified_at` seen this run is only safe if every task
 * modified before that point was actually processed — with no ordering
 * guarantee, a page-capped run for a workspace with more overdue tasks
 * than `MAX_TASK_PAGES_PER_WORKSPACE` covers could compute a `maxCursor`
 * that's already past some unprocessed task's real `modified_at`,
 * permanently excluding it from every future `modified_since` fetch with
 * no error or signal. Since there is no way to fetch this data in a
 * genuinely safe order, the fix instead never trusts a cursor computed
 * from a truncated run: if any workspace's fetch hit
 * `MAX_TASK_PAGES_PER_WORKSPACE` with more pages still available, this
 * run's `cursorAfter` stays at `cursorBefore` unchanged (never advances),
 * so the next run re-scans the identical window — safe (idempotent via
 * `ON CONFLICT DO NOTHING`) and guaranteed to eventually converge once
 * the backlog shrinks under one run's cap, the same "the safe direction
 * for a signal to be wrong" discipline `endOfDateOnlyDayUtc`
 * (`@signaldesk/domain`) already established for date-only due fields.
 */
export async function syncAsanaTasks(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  accessToken: string,
  asanaUserId: string,
  trigger: SyncJobTrigger,
): Promise<AsanaSyncResult> {
  const now = new Date();
  const [previousJob] = await listRecentSyncJobsForConnection(
    pool,
    organizationId,
    integrationId,
    1,
    "task",
    true,
  );
  const cursorBefore = previousJob?.cursorAfter ?? null;
  const job = await startSyncJob(
    pool,
    organizationId,
    integrationId,
    "asana",
    "task",
    trigger,
    cursorBefore,
  );

  let ingested = 0;
  let skipped = 0;
  let defaultedNameCount = 0;
  let maxCursor: string | null = cursorBefore;
  // Set when any workspace's fetch hits MAX_TASK_PAGES_PER_WORKSPACE with
  // more pages still available — see this function's own doc comment for
  // why a truncated run must never advance the cursor.
  let truncated = false;

  try {
    const workspaces = await fetchAsanaWorkspaces(accessToken);

    for (const workspace of workspaces) {
      let offset: string | undefined;
      let page = 0;

      for (; page < MAX_TASK_PAGES_PER_WORKSPACE; page += 1) {
        const taskPage = await fetchAsanaTasks(
          accessToken,
          asanaUserId,
          workspace.gid,
          offset,
          cursorBefore ?? undefined,
        );

        for (const rawTask of taskPage.results as readonly AsanaTask[]) {
          const seenAt = rawTask.modified_at;

          if (seenAt && (!maxCursor || seenAt > maxCursor)) {
            maxCursor = seenAt;
          }

          const mapped = mapAsanaTaskToSourceTaskRecord(rawTask, now);

          if (mapped === null) {
            // Not a sync failure — a real task with no due date/due-on set
            // in Asana. Logged (not counted in `skipped`) so it doesn't
            // fold into `completeSyncJob`'s `itemsSkipped > 0` check and
            // wrongly mark a perfectly healthy connection "degraded".
            logger.log(
              "info",
              `Asana task ${rawTask.gid} has no due date; not ingested.`,
              {
                operation: "sync_asana.task_no_due_date",
                connectorSlug: "asana",
                organizationId,
                correlationId: integrationId,
              },
            );
            continue;
          }

          if (detectAsanaTaskDefaultedFields(rawTask).length > 0) {
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
              operation: "sync_asana.task_validation",
              connectorSlug: "asana",
              organizationId,
              correlationId: integrationId,
            });
            skipped += 1;
            continue;
          }

          const result = await ingestAsanaTask(
            pool,
            organizationId,
            integrationId,
            {
              externalRecordId: taskRecord.source.externalRecordId,
              sourceVersion: taskRecord.source.sourceVersion,
              rawPayloadSha256: taskRecord.source.recordDigestSha256,
              rawPayloadByteLength: JSON.stringify(rawTask).length,
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

        if (!taskPage.nextOffset) {
          break;
        }

        offset = taskPage.nextOffset;
      }

      // The loop above only reaches page === MAX_TASK_PAGES_PER_WORKSPACE
      // without breaking when the very last fetched page still had a
      // truthy nextOffset — i.e. real, unprocessed data remains for this
      // workspace.
      if (page === MAX_TASK_PAGES_PER_WORKSPACE) {
        truncated = true;
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
    cursorAfter: truncated ? cursorBefore : maxCursor,
  });

  if (truncated) {
    logger.log(
      "warn",
      "Asana sync: hit the per-workspace page cap with more data remaining; cursor left unchanged so the next run re-covers this window.",
      {
        operation: "sync_asana.task_truncated",
        connectorSlug: "asana",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  if (skipped > 0) {
    logger.log(
      "warn",
      `Asana sync: skipped ${skipped} task(s) that failed validation.`,
      {
        operation: "sync_asana.task_summary",
        connectorSlug: "asana",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  if (defaultedNameCount > 0) {
    logger.log(
      "warn",
      `Asana sync: ${defaultedNameCount} task(s) had an unresolvable name or assignee and fell back to a placeholder.`,
      {
        operation: "sync_asana.task_defaulted_name",
        connectorSlug: "asana",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  return { ingested, skipped, defaultedNameCount };
}
