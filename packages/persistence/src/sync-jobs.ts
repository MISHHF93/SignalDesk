import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export type SyncJobTrigger = "initial" | "manual" | "webhook";
export type SyncJobStatus = "running" | "succeeded" | "failed";
/** The canonical entity a sync run produced — distinct from
 * `sourceSystem` (FK'd to the connector's own source_system, so it can't
 * also discriminate entity type). Needed because a single connector can
 * sync more than one entity type (QuickBooks: invoices and payments) —
 * without this, "the previous run's cursorAfter" would read whichever
 * entity type happened to sync most recently, corrupting the other
 * entity's incremental-sync cursor. */
export type SyncJobEntityType =
  "lead" | "invoice" | "payment" | "task" | "message" | "support_ticket";

export interface SyncJob {
  readonly id: string;
  readonly organizationId: string;
  readonly integrationId: string;
  readonly sourceSystem: string;
  readonly entityType: SyncJobEntityType;
  readonly trigger: SyncJobTrigger;
  readonly status: SyncJobStatus;
  readonly itemsIngested: number;
  readonly itemsSkipped: number;
  readonly cursorBefore: string | null;
  readonly cursorAfter: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

interface SyncJobRow {
  readonly id: string;
  readonly organization_id: string;
  readonly integration_id: string;
  readonly source_system: string;
  readonly entity_type: string;
  readonly trigger: string;
  readonly status: string;
  readonly items_ingested: number;
  readonly items_skipped: number;
  readonly cursor_before: string | null;
  readonly cursor_after: string | null;
  readonly error_message: string | null;
  readonly started_at: Date;
  readonly completed_at: Date | null;
}

const SYNC_JOB_COLUMNS =
  "id, organization_id, integration_id, source_system, entity_type, trigger, status, items_ingested, items_skipped, cursor_before, cursor_after, error_message, started_at, completed_at";

function toSyncJob(row: SyncJobRow): SyncJob {
  return {
    id: row.id,
    organizationId: row.organization_id,
    integrationId: row.integration_id,
    sourceSystem: row.source_system,
    entityType: row.entity_type as SyncJobEntityType,
    trigger: row.trigger as SyncJobTrigger,
    status: row.status as SyncJobStatus,
    itemsIngested: row.items_ingested,
    itemsSkipped: row.items_skipped,
    cursorBefore: row.cursor_before,
    cursorAfter: row.cursor_after,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

/**
 * Starts one real sync run — the durable record `completeSyncJob`/
 * `failSyncJob` later update. `cursorBefore` is the caller's responsibility
 * to supply (typically the previous job's `cursorAfter` *for the same
 * `entityType`*, read via `listRecentSyncJobsForConnection`) — this
 * function does not look it up itself, so a caller that wants a fresh
 * sync unaffected by history can pass `null` deliberately.
 */
export async function startSyncJob(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  sourceSystem: string,
  entityType: SyncJobEntityType,
  trigger: SyncJobTrigger,
  cursorBefore: string | null,
): Promise<SyncJob> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<SyncJobRow>(
      `insert into sync_jobs (
         id, organization_id, integration_id, source_system, entity_type, trigger, cursor_before
       ) values ($1, $2, $3, $4, $5, $6, $7)
       returning ${SYNC_JOB_COLUMNS}`,
      [
        randomUUID(),
        organizationId,
        integrationId,
        sourceSystem,
        entityType,
        trigger,
        cursorBefore,
      ],
    );

    return toSyncJob(result.rows[0]!);
  });
}

async function updateSyncJob(
  pool: DatabasePool,
  organizationId: string,
  jobId: string,
  status: "succeeded" | "failed",
  result: {
    readonly itemsIngested: number;
    readonly itemsSkipped: number;
    readonly cursorAfter?: string | null;
    readonly errorMessage?: string | null;
  },
): Promise<SyncJob> {
  return withTenantContext(pool, organizationId, async (client) => {
    const updateResult = await client.query<SyncJobRow>(
      `update sync_jobs
       set status = $3, items_ingested = $4, items_skipped = $5,
           cursor_after = $6, error_message = $7, completed_at = now()
       where organization_id = $1 and id = $2
       returning ${SYNC_JOB_COLUMNS}`,
      [
        organizationId,
        jobId,
        status,
        result.itemsIngested,
        result.itemsSkipped,
        result.cursorAfter ?? null,
        result.errorMessage ?? null,
      ],
    );
    const row = updateResult.rows[0];

    if (!row) {
      throw new Error(`sync_jobs row not found: ${jobId}`);
    }

    return toSyncJob(row);
  });
}

/**
 * Completes a job and, in the same call, reacts to what it found: a run
 * that skipped one or more records (a mapper validation failure — the
 * source system sent a shape the schema doesn't recognize) marks the
 * connection `degraded`; a clean run (`itemsSkipped: 0`) recovers a
 * previously `degraded` connection back to `active` (Prompt 34,
 * docs/product-vision-backlog.md, ADR 0043). Only ever transitions
 * between `active`⇄`degraded` — a `disconnected`/`revoked`/`pending`
 * connection is never touched, so this can't resurrect or mask an
 * intentional connection-lifecycle state. Distinct from
 * `ConnectorHealth.status` (`connector-health.ts`, ADR 0021, "derived,
 * never persisted"): that's a read-time projection over `sync_jobs`
 * success/failure for calm status copy; this is a real, persisted
 * `integrations.status` transition driven by per-record schema-shape
 * evidence, an independent signal the schema already anticipated (the
 * column's own check constraint has allowed `'degraded'` since ADR
 * 0021, unused until now).
 */
export async function completeSyncJob(
  pool: DatabasePool,
  organizationId: string,
  jobId: string,
  result: {
    readonly itemsIngested: number;
    readonly itemsSkipped: number;
    readonly cursorAfter: string | null;
  },
): Promise<SyncJob> {
  const job = await updateSyncJob(
    pool,
    organizationId,
    jobId,
    "succeeded",
    result,
  );

  await withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      `update integrations
       set status = case when $3 > 0 then 'degraded' else 'active' end
       where organization_id = $1 and id = $2 and status in ('active', 'degraded')`,
      [organizationId, job.integrationId, result.itemsSkipped],
    );
  });

  return job;
}

export async function failSyncJob(
  pool: DatabasePool,
  organizationId: string,
  jobId: string,
  result: {
    readonly itemsIngested: number;
    readonly itemsSkipped: number;
    readonly errorMessage: string;
  },
): Promise<SyncJob> {
  return updateSyncJob(pool, organizationId, jobId, "failed", result);
}

const DEFAULT_RECENT_SYNC_JOBS_LIMIT = 5;

/**
 * Newest-first sync runs for one connection — what both
 * `computeConnectorHealth` (derives status/freshness across every entity
 * type this connection syncs) and a caller computing this run's
 * `cursorBefore` need. `entityType`, when passed, scopes to runs for that
 * entity only — required for a correct cursor lookup on a connector that
 * syncs more than one entity type (e.g. QuickBooks invoices vs.
 * payments), since two entity types' cursors are otherwise
 * indistinguishable by `(organizationId, integrationId)` alone. Omitted
 * (health's own use case), this returns the most recent runs across every
 * entity type. Capped like every other "real set" list in this app.
 */
export async function listRecentSyncJobsForConnection(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  limit: number = DEFAULT_RECENT_SYNC_JOBS_LIMIT,
  entityType?: SyncJobEntityType,
): Promise<readonly SyncJob[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const params: unknown[] = [organizationId, integrationId];
    let entityTypeClause = "";

    if (entityType) {
      params.push(entityType);
      entityTypeClause = ` and entity_type = $${params.length}`;
    }

    const result = await client.query<SyncJobRow>(
      `select ${SYNC_JOB_COLUMNS} from sync_jobs
       where organization_id = $1 and integration_id = $2${entityTypeClause}
       order by started_at desc
       limit ${Math.max(1, Math.floor(limit))}`,
      params,
    );

    return result.rows.map(toSyncJob);
  });
}
