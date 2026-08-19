import { createHash, randomUUID } from "node:crypto";

import type { CreateInternalTaskInput } from "@signaldesk/schemas";

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
