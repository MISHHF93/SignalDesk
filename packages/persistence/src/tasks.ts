import { randomUUID } from "node:crypto";

import type { Task } from "@business-dashboard/domain";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Writes one mapped Asana task into `source_records` → `tasks`. Mirrors
 * `ingestQuickBooksInvoice`/`ingestHubSpotDeal` exactly — append-only for
 * app_runtime, idempotent on `(organization_id, idempotency_key)`, a
 * one-time initial ingest, not incremental re-sync.
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
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length
       ) values ($1, $2, $3, 'asana', 'task', $4, $5, 1, $6, $7, $8, $9)
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
      ],
    );

    const insertedSourceRecord = sourceRecordResult.rows[0];

    if (!insertedSourceRecord) {
      // Already ingested at this exact source_version — not an error.
      return { sourceRecordId: null, taskId: null, inserted: false };
    }

    const taskId = randomUUID();

    await client.query(
      `insert into tasks (
         id, organization_id, source_record_id,
         name, assignee_name, due_at, completed,
         canonical_schema_version, normalization_version
       ) values (
         $1, $2, $3,
         $4, $5, $6, $7,
         1, 'asana-task-v1'
       )`,
      [
        taskId,
        organizationId,
        insertedSourceRecord.id,
        input.name,
        input.assigneeName,
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

const MAX_OVERDUE_TASKS = 10;

/**
 * Every currently-overdue, incomplete task worth surfacing — mirrors
 * `listOverdueInvoices` exactly: the real set (not one representative
 * record), capped at `MAX_OVERDUE_TASKS`, ordered oldest-due-first, and
 * only from `active` source integrations (disconnecting a connector means
 * "stop using my data," not just "stop the token from working").
 */
export async function listOverdueTasks(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly Task[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<TaskWithSourceRow>(
      `select
         t.id as id,
         t.organization_id as organization_id,
         t.name as name,
         t.assignee_name as assignee_name,
         t.due_at as due_at,
         t.completed as completed,
         sr.integration_id as integration_id,
         sr.source_system as source_system,
         sr.external_record_id as external_record_id,
         sr.source_version as source_version,
         sr.raw_payload_sha256 as record_digest_sha256,
         sr.ingested_at as last_synced_at
       from tasks t
       join source_records sr
         on sr.organization_id = t.organization_id and sr.id = t.source_record_id
       join integrations ig
         on ig.organization_id = t.organization_id and ig.id = sr.integration_id
       where t.organization_id = $1
         and t.completed = false
         and t.due_at < now()
         and ig.status = 'active'
       order by t.due_at asc
       limit ${MAX_OVERDUE_TASKS}`,
      [organizationId],
    );

    return result.rows.map(toTask);
  });
}
