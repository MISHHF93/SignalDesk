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
  type DatabasePool,
  type SyncJobTrigger,
} from "@signaldesk/persistence";
import { parseSourceTaskRecord } from "@signaldesk/schemas";

import { getAsanaClientCredentials } from "./asana-config";

// Mirrors the OAuth callback's own per-workspace stopgap.
const MAX_TASK_PAGES_PER_WORKSPACE = 20;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface AsanaSyncResult {
  readonly ingested: number;
  readonly skipped: number;
  /** Tasks whose `name` was missing and fell back to a placeholder
   * (`detectAsanaTaskDefaultedFields`) — mirrors `sync-hubspot.ts`'s own
   * `defaultedNameCount`: logged for visibility, deliberately never
   * folded into `skipped`, since the record still ingested successfully. */
  readonly defaultedNameCount: number;
}

/**
 * Returns a valid access token for this integration, refreshing and
 * re-persisting it first if it's expired or expiring within 5 minutes.
 * Asana access tokens last only ~1 hour, so unlike the OAuth callback
 * (always freshly exchanged), "Sync Now" needs this on nearly every call.
 */
export async function ensureFreshAsanaAccessToken(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<string> {
  const tokens = await getAsanaTokens(pool, organizationId, integrationId);

  if (!tokens) {
    throw new Error("No stored Asana tokens for this integration.");
  }

  if (tokens.expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }

  const config = getAsanaClientCredentials();
  const refreshed = await refreshAsanaAccessToken(config, tokens.refreshToken);

  await storeAsanaTokens(pool, organizationId, integrationId, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
  });

  return refreshed.accessToken;
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

  try {
    const workspaces = await fetchAsanaWorkspaces(accessToken);

    for (const workspace of workspaces) {
      let offset: string | undefined;

      for (let page = 0; page < MAX_TASK_PAGES_PER_WORKSPACE; page += 1) {
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
            console.info(
              `Asana task ${rawTask.gid} has no due date; not ingested.`,
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
            console.error(
              `Skipping Asana task ${rawTask.gid}: failed validation`,
              validationError,
            );
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
    console.error(
      `Asana sync: skipped ${skipped} task(s) that failed validation for integration ${integrationId}.`,
    );
  }

  if (defaultedNameCount > 0) {
    console.error(
      `Asana sync: ${defaultedNameCount} task(s) had no usable name and fell back to a placeholder for integration ${integrationId}.`,
    );
  }

  return { ingested, skipped, defaultedNameCount };
}
