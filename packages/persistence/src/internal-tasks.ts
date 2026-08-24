import { createHash, randomUUID } from "node:crypto";

import type {
  CompleteInternalTaskInput,
  CreateInternalTaskInput,
} from "@signaldesk/schemas";

import {
  STANDARD_AUDIT_RETENTION_CLASS,
  STANDARD_AUDIT_RETENTION_INTERVAL,
} from "./audit-retention";
import type { DatabasePool } from "./client";
import { resolveMembershipId } from "./membership";
import { withTenantContext } from "./tenant-context";

export type { CreateInternalTaskInput };

export interface CreateInternalTaskResult {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "completed";
  readonly createdAt: Date;
  /**
   * `false` on an idempotent replay (the same `idempotencyKey` already
   * created this task) — the caller gets back the original task, not a
   * new one. Without this, the UI has no way to distinguish "just
   * created" from "you already did this," and would show a stale
   * `createdAt` timestamp as if it were fresh.
   */
  readonly created: boolean;
}

interface InternalTaskRow {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly created_at: Date;
}

function toResult(
  task: InternalTaskRow,
  created: boolean,
): CreateInternalTaskResult {
  return {
    id: task.id,
    title: task.title,
    status: task.status === "completed" ? "completed" : "open",
    createdAt: task.created_at,
    created,
  };
}

/**
 * Creates an internal task and its audit event in one tenant-scoped
 * transaction — the concrete implementation of the `create_internal_task`
 * safe action (README's action policy table: "allowed only within scoped
 * policy and with an audit event"). This function does not authorize the
 * caller; the caller (a Server Action today, a real authenticated request
 * handler later) is responsible for resolving a trustworthy
 * `organizationId` before calling it.
 *
 * `userId` must resolve to a real membership in `organizationId` — the
 * audit event records exactly which member triggered this action
 * (`actor_kind: 'user'`), never just the organization.
 *
 * `input.idempotencyKey` must be stable across a retry of the same logical
 * request (a caller-generated key derived from what's being acted on, e.g.
 * a card and action id — never freshly random per call). A retry with the
 * same key returns the original task instead of creating a duplicate.
 */
export async function createInternalTask(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  input: CreateInternalTaskInput,
): Promise<CreateInternalTaskResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const membershipId = await resolveMembershipId(
      client,
      organizationId,
      userId,
    );

    const taskId = randomUUID();

    const taskResult = await client.query<InternalTaskRow>(
      `insert into internal_tasks (id, organization_id, title, description, source_card_id, idempotency_key)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (organization_id, idempotency_key) do nothing
       returning id, title, status, created_at`,
      [
        taskId,
        organizationId,
        input.title,
        input.description ?? null,
        input.sourceCardId ?? null,
        input.idempotencyKey,
      ],
    );

    const insertedTask = taskResult.rows[0];

    if (!insertedTask) {
      // A prior call with this exact idempotency key already created the
      // task — return it rather than erroring or duplicating.
      const existingResult = await client.query<InternalTaskRow>(
        `select id, title, status, created_at from internal_tasks
         where organization_id = $1 and idempotency_key = $2`,
        [organizationId, input.idempotencyKey],
      );
      const existingTask = existingResult.rows[0];

      if (!existingTask) {
        throw new Error(
          "internal_tasks idempotency conflict but no existing row found",
        );
      }

      return toResult(existingTask, false);
    }

    const auditEventId = randomUUID();
    const metadata = JSON.stringify({
      title: input.title,
      sourceCardId: input.sourceCardId ?? null,
    });
    const payloadDigest = createHash("sha256")
      .update(`${insertedTask.id}:${input.title}`)
      .digest("hex");
    const eventDigest = createHash("sha256")
      .update(`${auditEventId}:${insertedTask.id}`)
      .digest("hex");
    const auditIdempotencyKey = `internal-task-create:${insertedTask.id}`;

    await client.query(
      `insert into audit_events (
         id, organization_id, actor_membership_id, actor_kind, event_type, event_schema_version,
         subject_type, subject_id, correlation_id, idempotency_key, outcome,
         payload_digest, event_digest, metadata, retention_class, retain_until, occurred_at
       ) values (
         $1, $2, $3, 'user', 'internal_task.created', 1, 'internal_task', $4, $5, $6, 'succeeded',
         $7, $8, $9::jsonb, $10, now() + $11::interval, now()
       )`,
      [
        auditEventId,
        organizationId,
        membershipId,
        insertedTask.id,
        auditIdempotencyKey,
        auditIdempotencyKey,
        payloadDigest,
        eventDigest,
        metadata,
        STANDARD_AUDIT_RETENTION_CLASS,
        STANDARD_AUDIT_RETENTION_INTERVAL,
      ],
    );

    return toResult(insertedTask, true);
  });
}

export interface OpenInternalTask {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly sourceCardId: string | null;
  readonly createdAt: Date;
}

interface OpenInternalTaskRow {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly source_card_id: string | null;
  readonly created_at: Date;
}

const MAX_OPEN_INTERNAL_TASKS = 50;

/**
 * Every open (not yet completed) internal task for the organization, newest
 * first — the read half of the loop `createInternalTask` only ever started:
 * a task created from a card's quick action had nowhere to be seen or
 * completed again until this existed. Capped at
 * `MAX_OPEN_INTERNAL_TASKS` for the same reason `listOverdueTasks` caps
 * itself — a real backlog should never make the One Page unbounded.
 */
export async function listOpenInternalTasks(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly OpenInternalTask[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<OpenInternalTaskRow>(
      `select id, title, description, source_card_id, created_at
       from internal_tasks
       where organization_id = $1 and status = 'open'
       order by created_at desc
       limit ${MAX_OPEN_INTERNAL_TASKS}`,
      [organizationId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      sourceCardId: row.source_card_id,
      createdAt: row.created_at,
    }));
  });
}

export interface CompleteInternalTaskResult {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "completed";
  /**
   * `false` when the task was already `completed` before this call (a
   * double-click, or a retry after a dropped response) — this call made no
   * further change rather than erroring, the same "replay is a no-op, not
   * a failure" contract `created` gives callers of `createInternalTask`.
   */
  readonly updated: boolean;
}

function toCompleteResult(
  task: InternalTaskRow,
  updated: boolean,
): CompleteInternalTaskResult {
  return {
    id: task.id,
    title: task.title,
    status: task.status === "completed" ? "completed" : "open",
    updated,
  };
}

/**
 * Marks one of the organization's own internal tasks completed, in the same
 * tenant-scoped-transaction-plus-audit-event shape as `createInternalTask`
 * — the concrete implementation of the safe action's other real write.
 * Naturally idempotent by construction (the `UPDATE` only ever matches a
 * currently-`open` row), so unlike `createInternalTask` this needs no
 * caller-supplied idempotency key: retrying with the same `taskId` after a
 * dropped response just finds nothing left to update and returns the
 * already-completed task.
 *
 * `taskId` not resolving to any row *this organization* can see (wrong
 * tenant, or it never existed) and `taskId` resolving to an already-
 * completed row are indistinguishable from outside — both return
 * `updated: false` — but only the latter reaches that branch, since RLS
 * makes the former's own lookup return nothing and fall to the "not found"
 * throw below instead.
 */
export async function completeInternalTask(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  input: CompleteInternalTaskInput,
): Promise<CompleteInternalTaskResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const membershipId = await resolveMembershipId(
      client,
      organizationId,
      userId,
    );

    const updateResult = await client.query<InternalTaskRow>(
      `update internal_tasks
       set status = 'completed'
       where organization_id = $1 and id = $2 and status = 'open'
       returning id, title, status, created_at`,
      [organizationId, input.taskId],
    );

    const updatedTask = updateResult.rows[0];

    if (updatedTask) {
      const auditEventId = randomUUID();
      const metadata = JSON.stringify({ title: updatedTask.title });
      const payloadDigest = createHash("sha256")
        .update(`${updatedTask.id}:completed`)
        .digest("hex");
      const eventDigest = createHash("sha256")
        .update(`${auditEventId}:${updatedTask.id}`)
        .digest("hex");
      const auditIdempotencyKey = `internal-task-complete:${updatedTask.id}`;

      await client.query(
        `insert into audit_events (
           id, organization_id, actor_membership_id, actor_kind, event_type, event_schema_version,
           subject_type, subject_id, correlation_id, idempotency_key, outcome,
           payload_digest, event_digest, metadata, retention_class, retain_until, occurred_at
         ) values (
           $1, $2, $3, 'user', 'internal_task.completed', 1, 'internal_task', $4, $5, $6, 'succeeded',
           $7, $8, $9::jsonb, $10, now() + $11::interval, now()
         )`,
        [
          auditEventId,
          organizationId,
          membershipId,
          updatedTask.id,
          auditIdempotencyKey,
          auditIdempotencyKey,
          payloadDigest,
          eventDigest,
          metadata,
          STANDARD_AUDIT_RETENTION_CLASS,
          STANDARD_AUDIT_RETENTION_INTERVAL,
        ],
      );

      return toCompleteResult(updatedTask, true);
    }

    const existingResult = await client.query<InternalTaskRow>(
      `select id, title, status, created_at from internal_tasks
       where organization_id = $1 and id = $2`,
      [organizationId, input.taskId],
    );
    const existingTask = existingResult.rows[0];

    if (!existingTask) {
      throw new Error("Task not found.");
    }

    return toCompleteResult(existingTask, false);
  });
}
