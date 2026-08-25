import { randomUUID } from "node:crypto";

import type { Task } from "@signaldesk/domain";

import type { DatabasePool } from "./client";
import { resolveMembershipIdByDisplayName } from "./membership";
import { withTenantContext } from "./tenant-context";

/**
 * Writes one mapped Asana task into `source_records` → `tasks`. Mirrors
 * `ingestQuickBooksInvoice`/`ingestHubSpotDeal` exactly — append-only for
 * app_runtime, idempotent on `(organization_id, idempotency_key)`, a
 * one-time initial ingest, not incremental re-sync. Also resolves real
 * ownership (Prompt 29, docs/product-vision-backlog.md, ADR 0039): if
 * `assigneeName` exactly matches a real member's display name, this task
 * is attributed to them.
 */

export interface IngestSourceTaskInput {
  readonly externalRecordId: string;
  readonly sourceVersion: string;
  readonly rawPayloadSha256: string;
  readonly rawPayloadByteLength: number;
  readonly observedAt: Date;
  readonly name: string;
  readonly assigneeName: string | null;
  readonly dueAt: Date;
  readonly completed: boolean;
  /** See `IngestSourceInvoiceInput.syncJobId`'s doc comment
   * (`invoices.ts`, ADR 0029) — the same real trace identity, required
   * for every real caller. */
  readonly syncJobId: string;
}

export interface IngestSourceTaskResult {
  readonly sourceRecordId: string | null;
  readonly taskId: string | null;
  readonly inserted: boolean;
}

export async function ingestAsanaTask(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  input: IngestSourceTaskInput,
): Promise<IngestSourceTaskResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordId = randomUUID();
    const idempotencyKey = `asana:task:${input.externalRecordId}:${input.sourceVersion}`;

    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
         sync_job_id
       ) values ($1, $2, $3, 'asana', 'task', $4, $5, 1, $6, $7, $8, $9, $10)
       on conflict (organization_id, idempotency_key) do nothing
       returning id`,
      [
        sourceRecordId,
        organizationId,
        integrationId,
        input.externalRecordId,
        input.sourceVersion,
        idempotencyKey,
        input.observedAt,
        input.rawPayloadSha256,
        input.rawPayloadByteLength,
        input.syncJobId,
      ],
    );

    const insertedSourceRecord = sourceRecordResult.rows[0];

    if (!insertedSourceRecord) {
      // Already ingested at this exact source_version — not an error.
      return { sourceRecordId: null, taskId: null, inserted: false };
    }

    const taskId = randomUUID();
    const ownerMembershipId = await resolveMembershipIdByDisplayName(
      client,
      organizationId,
      input.assigneeName,
    );

    await client.query(
      `insert into tasks (
         id, organization_id, source_record_id,
         name, assignee_name, owner_membership_id, due_at, completed,
         canonical_schema_version, normalization_version
       ) values (
         $1, $2, $3,
         $4, $5, $6, $7, $8,
         1, 'asana-task-v1'
       )`,
      [
        taskId,
        organizationId,
        insertedSourceRecord.id,
        input.name,
        input.assigneeName,
        ownerMembershipId,
        input.dueAt,
        input.completed,
      ],
    );

    return { sourceRecordId: insertedSourceRecord.id, taskId, inserted: true };
  });
}

/**
 * Writes one mapped Jira issue into `source_records` → `tasks`. Mirrors
 * `ingestAsanaTask` exactly — same shared `tasks` table, same append-
 * only/idempotent semantics, only the `source_system`/
 * `source_object_type`/`normalization_version` literals differ.
 */
export async function ingestJiraIssue(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  input: IngestSourceTaskInput,
): Promise<IngestSourceTaskResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordId = randomUUID();
    const idempotencyKey = `jira:issue:${input.externalRecordId}:${input.sourceVersion}`;

    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
         sync_job_id
       ) values ($1, $2, $3, 'jira', 'issue', $4, $5, 1, $6, $7, $8, $9, $10)
       on conflict (organization_id, idempotency_key) do nothing
       returning id`,
      [
        sourceRecordId,
        organizationId,
        integrationId,
        input.externalRecordId,
        input.sourceVersion,
        idempotencyKey,
        input.observedAt,
        input.rawPayloadSha256,
        input.rawPayloadByteLength,
        input.syncJobId,
      ],
    );

    const insertedSourceRecord = sourceRecordResult.rows[0];

    if (!insertedSourceRecord) {
      // Already ingested at this exact source_version — not an error.
      return { sourceRecordId: null, taskId: null, inserted: false };
    }

    const taskId = randomUUID();
    const ownerMembershipId = await resolveMembershipIdByDisplayName(
      client,
      organizationId,
      input.assigneeName,
    );

    await client.query(
      `insert into tasks (
         id, organization_id, source_record_id,
         name, assignee_name, owner_membership_id, due_at, completed,
         canonical_schema_version, normalization_version
       ) values (
         $1, $2, $3,
         $4, $5, $6, $7, $8,
         1, 'jira-issue-v1'
       )`,
      [
        taskId,
        organizationId,
        insertedSourceRecord.id,
        input.name,
        input.assigneeName,
        ownerMembershipId,
        input.dueAt,
        input.completed,
      ],
    );

    return { sourceRecordId: insertedSourceRecord.id, taskId, inserted: true };
  });
}

interface TaskWithSourceRow {
  readonly id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly assignee_name: string | null;
  readonly owner_membership_id: string | null;
  readonly owner_display_name: string | null;
  readonly due_at: Date;
  readonly completed: boolean;
  readonly integration_id: string;
  readonly source_system: string;
  readonly external_record_id: string;
  readonly source_version: string;
  readonly record_digest_sha256: string;
  readonly last_synced_at: Date;
}

function toTask(row: TaskWithSourceRow): Task {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    assigneeName: row.assignee_name,
    owner:
      row.owner_membership_id === null
        ? null
        : {
            id: row.owner_membership_id,
            name: row.owner_display_name ?? "Unknown owner",
          },
    dueAt: row.due_at,
    completed: row.completed,
    source: {
      integrationId: row.integration_id,
      system: row.source_system,
      externalRecordId: row.external_record_id,
      sourceVersion: row.source_version,
      recordDigestSha256: row.record_digest_sha256,
      lastSyncedAt: row.last_synced_at,
    },
  };
}

const TASK_SELECT_COLUMNS = `
         t.id as id,
         t.organization_id as organization_id,
         t.name as name,
         t.assignee_name as assignee_name,
         t.owner_membership_id as owner_membership_id,
         u.display_name as owner_display_name,
         t.due_at as due_at,
         t.completed as completed,
         sr.integration_id as integration_id,
         sr.source_system as source_system,
         sr.external_record_id as external_record_id,
         sr.source_version as source_version,
         sr.raw_payload_sha256 as record_digest_sha256,
         sr.ingested_at as last_synced_at`;

const TASK_OWNER_JOIN = `
       left join memberships m
         on m.organization_id = t.organization_id and m.id = t.owner_membership_id
       left join users u on u.id = m.user_id`;

const MAX_OVERDUE_TASKS = 10;

/**
 * Every currently-overdue, incomplete task worth surfacing — mirrors
 * `listOverdueInvoices` exactly, including its dedup fix: the real set (not
 * one representative record), capped at `MAX_OVERDUE_TASKS`, ordered
 * oldest-due-first, from `active`/`degraded` source integrations only, and
 * deduplicated to the single most-recently-observed `source_records` row
 * per `(source_system, external_record_id)` before filtering — ingest is
 * append-only (`ingestAsanaTask`'s own doc comment), so a re-sync that sees
 * a new `source_version` on a still-incomplete task inserts a brand-new
 * `tasks` row rather than updating the old one in place, and without this
 * the stale older row kept matching `completed = false and due_at < now()`
 * forever, producing a second live card for the same real-world task (see
 * `listOverdueInvoices`'s doc comment for the full root-cause explanation).
 */
export async function listOverdueTasks(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly Task[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<TaskWithSourceRow>(
      `select * from (
         select distinct on (sr.source_system, sr.external_record_id)${TASK_SELECT_COLUMNS}
         from tasks t
         join source_records sr
           on sr.organization_id = t.organization_id and sr.id = t.source_record_id
         join integrations ig
           on ig.organization_id = t.organization_id and ig.id = sr.integration_id${TASK_OWNER_JOIN}
         where t.organization_id = $1
           and ig.status in ('active', 'degraded')
         order by sr.source_system, sr.external_record_id, sr.observed_at desc
       ) latest_tasks
       where completed = false
         and due_at < now()
       order by due_at asc
       limit ${MAX_OVERDUE_TASKS}`,
      [organizationId],
    );

    return result.rows.map(toTask);
  });
}

/**
 * One real task by id, for a single-entity "draft content about one
 * specific entity" write action (e.g. an Asana task nudge) — reuses
 * `listOverdueTasks`'s core `tasks` ⋈ `source_records` join (via the
 * shared `TASK_SELECT_COLUMNS`/`TASK_OWNER_JOIN` fragments) and its
 * `toTask` row mapper, but unlike `listOverdueTasks` applies none of its
 * filtering conditions (`completed = false`, `due_at < now()`,
 * active/degraded integration only) or its dedup-to-latest-source-record
 * subquery — a direct single-entity-by-id lookup should honestly return
 * the task's current real state regardless of whether it's still
 * "overdue," matching `getSupportTicketById`'s same behavior
 * (`support-tickets.ts`). Returns `null` for a task that doesn't exist or
 * doesn't belong to the caller's own tenant (RLS reduces the query to
 * zero rows rather than raising, so this is a real, honest "not found,"
 * not a leaked existence check).
 */
export async function getTaskById(
  pool: DatabasePool,
  organizationId: string,
  taskId: string,
): Promise<Task | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<TaskWithSourceRow>(
      `select${TASK_SELECT_COLUMNS}
       from tasks t
       join source_records sr
         on sr.organization_id = t.organization_id and sr.id = t.source_record_id${TASK_OWNER_JOIN}
       where t.organization_id = $1
         and t.id = $2`,
      [organizationId, taskId],
    );

    const row = result.rows[0];

    return row ? toTask(row) : null;
  });
}

const MAX_EXPORTED_TASKS = 1000;

/**
 * Every task for a real data-export request -- unlike `listOverdueTasks`,
 * not filtered to overdue/incomplete or active-integration only. Capped at
 * `MAX_EXPORTED_TASKS`, newest first.
 */
export async function listAllTasks(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly Task[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<TaskWithSourceRow>(
      `select${TASK_SELECT_COLUMNS}
       from tasks t
       join source_records sr
         on sr.organization_id = t.organization_id and sr.id = t.source_record_id${TASK_OWNER_JOIN}
       where t.organization_id = $1
       order by t.due_at desc
       limit ${MAX_EXPORTED_TASKS}`,
      [organizationId],
    );

    return result.rows.map(toTask);
  });
}
