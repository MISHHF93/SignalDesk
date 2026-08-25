import { createHash, randomUUID } from "node:crypto";

import {
  STANDARD_AUDIT_RETENTION_CLASS,
  STANDARD_AUDIT_RETENTION_INTERVAL,
} from "./audit-retention";
import type { DatabasePool } from "./client";
import { resolveMembershipId } from "./membership";
import { withTenantContext } from "./tenant-context";

/**
 * The Safe Action pattern's fourth real write path (ADR 0057), mirroring
 * `customer-email-replies.ts` exactly: the real side effect (the Asana
 * story-create API call) happens between `beginAsanaTaskNudgeSend` and
 * `completeAsanaTaskNudgeSend`, outside any one DB transaction, so a row's
 * status is a durable lifecycle rather than a single insert.
 *
 * Disclosed limitation, same shape as the Gmail case: if the process
 * crashes after Asana accepts the story but before
 * `completeAsanaTaskNudgeSend` commits, the row is left `'pending'` with
 * no way to know whether the nudge actually posted.
 * `beginAsanaTaskNudgeSend` treats a pre-existing `'pending'` row as
 * unsafe to auto-retry — it returns `alreadyResolved: "pending"` and the
 * caller must surface a manual check, never silently resend. A `'failed'`
 * row (Asana was never reached successfully) is reset to `'pending'` and
 * is safe to retry on the same row.
 *
 * Body-only — an Asana story is a plain comment, not an email, so there's
 * no subject column. `asana_story_gid` is the real send evidence: Asana's
 * story-create response returns a distinct gid, required non-null on a
 * `'sent'` row.
 */

export interface BeginAsanaTaskNudgeSendInput {
  readonly userId: string;
  readonly agentCollaborationId: string;
  readonly taskId: string;
  readonly body: string;
  readonly idempotencyKey: string;
}

export type BeginAsanaTaskNudgeSendResult =
  | { readonly id: string; readonly alreadyResolved: null }
  | { readonly id: string; readonly alreadyResolved: "pending" }
  | {
      readonly id: string;
      readonly alreadyResolved: "sent";
      readonly asanaStoryGid: string;
    };

interface AsanaTaskNudgeStatusRow {
  readonly id: string;
  readonly status: string;
  readonly asana_story_gid: string | null;
}

/**
 * Begins (or resumes) one send attempt. Returns the row id the caller must
 * pass to `completeAsanaTaskNudgeSend`, plus whether this is a fresh
 * attempt (`alreadyResolved: null` — safe to call Asana) or a replay the
 * caller must not re-execute (`"sent"`/`"pending"`).
 */
export async function beginAsanaTaskNudgeSend(
  pool: DatabasePool,
  organizationId: string,
  input: BeginAsanaTaskNudgeSendInput,
): Promise<BeginAsanaTaskNudgeSendResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const membershipId = await resolveMembershipId(
      client,
      organizationId,
      input.userId,
    );

    const insertResult = await client.query<{ id: string }>(
      `insert into asana_task_nudges (
         id, organization_id, agent_collaboration_id, task_id,
         triggered_by_membership_id, idempotency_key, body
       ) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (organization_id, idempotency_key) do nothing
       returning id`,
      [
        randomUUID(),
        organizationId,
        input.agentCollaborationId,
        input.taskId,
        membershipId,
        input.idempotencyKey,
        input.body,
      ],
    );

    const inserted = insertResult.rows[0];

    if (inserted) {
      return { id: inserted.id, alreadyResolved: null };
    }

    // A prior call with this exact idempotency key already created a row —
    // resolve what should happen next from its current status.
    const existingResult = await client.query<AsanaTaskNudgeStatusRow>(
      `select id, status, asana_story_gid
       from asana_task_nudges
       where organization_id = $1 and idempotency_key = $2`,
      [organizationId, input.idempotencyKey],
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      throw new Error(
        "asana_task_nudges idempotency conflict but no existing row found",
      );
    }

    if (existing.status === "sent") {
      if (!existing.asana_story_gid) {
        throw new Error(
          `asana_task_nudges row ${existing.id} is 'sent' but missing its asana_story_gid`,
        );
      }

      return {
        id: existing.id,
        alreadyResolved: "sent",
        asanaStoryGid: existing.asana_story_gid,
      };
    }

    if (existing.status === "pending") {
      return { id: existing.id, alreadyResolved: "pending" };
    }

    // status === "failed": Asana was never reached successfully, so this
    // row is safe to retry — reset it to 'pending' rather than leaving it
    // stuck, so completeAsanaTaskNudgeSend's "only transition a
    // currently-pending row" guard still applies to the retry. Guarded by
    // `and status = 'failed'` and re-checked via RETURNING — see
    // customer-email-replies.ts's identical fix for why: without this,
    // two concurrent retries of the same failed idempotency key could both
    // read 'failed' before either UPDATE commits and both call the real
    // Asana API. If this UPDATE affects zero rows, another concurrent call
    // already won that race and is now responsible for the real send.
    const resetResult = await client.query<{ id: string }>(
      `update asana_task_nudges
       set status = 'pending', failure_reason = null, updated_at = now()
       where organization_id = $1 and id = $2 and status = 'failed'
       returning id`,
      [organizationId, existing.id],
    );

    if (resetResult.rows[0]) {
      return { id: existing.id, alreadyResolved: null };
    }

    // Real bug found by review: this used to hardcode `alreadyResolved:
    // "pending"` here without re-checking — the concurrent caller that
    // won the reset race above may have already completed the *entire*
    // send-and-complete cycle by the time this call's own UPDATE loses
    // that race, misreporting a real, successful send as still
    // unresolved. See customer-email-replies.ts's identical fix.
    const reCheckedResult = await client.query<AsanaTaskNudgeStatusRow>(
      `select id, status, asana_story_gid
       from asana_task_nudges
       where organization_id = $1 and id = $2`,
      [organizationId, existing.id],
    );
    const reChecked = reCheckedResult.rows[0];

    if (reChecked?.status === "sent" && reChecked.asana_story_gid) {
      return {
        id: reChecked.id,
        alreadyResolved: "sent",
        asanaStoryGid: reChecked.asana_story_gid,
      };
    }

    return { id: existing.id, alreadyResolved: "pending" };
  });
}

/**
 * The most recent successful send for this task, or `null` if none
 * exists — the real fact `runPreFlightPolicyAudit`'s duplicate-send-window
 * check needs (`apps/web/app/_lib/pre-flight-policy-audit.ts`, ADR 0058).
 * Reads only `'sent'` rows: a `'pending'`/`'failed'` attempt never actually
 * posted, so it has no bearing on whether a fresh nudge would double-post.
 */
export async function getMostRecentAsanaTaskNudgeSentAt(
  pool: DatabasePool,
  organizationId: string,
  taskId: string,
): Promise<Date | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ sent_at: Date }>(
      `select sent_at
       from asana_task_nudges
       where organization_id = $1 and task_id = $2 and status = 'sent'
       order by sent_at desc
       limit 1`,
      [organizationId, taskId],
    );

    return result.rows[0]?.sent_at ?? null;
  });
}

export type CompleteAsanaTaskNudgeSendOutcome =
  | {
      readonly status: "sent";
      readonly sentAt: Date;
      readonly storyGid: string;
    }
  | { readonly status: "failed"; readonly failureReason: string };

/**
 * Records the real outcome of an Asana story-create attempt — status
 * update and audit event in one transaction, the same mutation-plus-audit
 * shape `completeCustomerEmailReplySend` uses, applied here to a status
 * transition since the real external side effect already happened by the
 * time this is called.
 *
 * Guarded by `where status = 'pending'`, mirroring `completeInternalTask`'s
 * "the UPDATE only ever matches a row still eligible for this transition"
 * idempotency doctrine: a repeat call for a row that already transitioned
 * away from 'pending' updates nothing and writes no new audit event, since
 * nothing new actually happened.
 */
export async function completeAsanaTaskNudgeSend(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  nudgeId: string,
  outcome: CompleteAsanaTaskNudgeSendOutcome,
): Promise<void> {
  return withTenantContext(pool, organizationId, async (client) => {
    const membershipId = await resolveMembershipId(
      client,
      organizationId,
      userId,
    );

    const updateResult =
      outcome.status === "sent"
        ? await client.query<{ id: string }>(
            `update asana_task_nudges
             set status = 'sent', asana_story_gid = $3, sent_at = $4, updated_at = now()
             where organization_id = $1 and id = $2 and status = 'pending'
             returning id`,
            [organizationId, nudgeId, outcome.storyGid, outcome.sentAt],
          )
        : await client.query<{ id: string }>(
            `update asana_task_nudges
             set status = 'failed', failure_reason = $3, updated_at = now()
             where organization_id = $1 and id = $2 and status = 'pending'
             returning id`,
            [organizationId, nudgeId, outcome.failureReason],
          );

    const updatedId = updateResult.rows[0]?.id;

    if (!updatedId) {
      // Already transitioned away from 'pending' by a prior call — no new
      // fact to record, so no new audit event either.
      return;
    }

    const auditEventId = randomUUID();
    const eventType =
      outcome.status === "sent"
        ? "asana_task_nudge.sent"
        : "asana_task_nudge.failed";
    const metadata = JSON.stringify(
      outcome.status === "sent"
        ? {
            asanaStoryGid: outcome.storyGid,
            sentAt: outcome.sentAt.toISOString(),
          }
        : { failureReason: outcome.failureReason },
    );
    const payloadDigest = createHash("sha256")
      .update(`${updatedId}:${outcome.status}`)
      .digest("hex");
    const eventDigest = createHash("sha256")
      .update(`${auditEventId}:${updatedId}`)
      .digest("hex");
    // 'sent' can only really happen once per row (the pending guard above
    // ensures that), so it gets a deterministic key. 'failed' can
    // legitimately recur across retries of the same row — a fresh random
    // component keeps each real failure its own audit event rather than
    // deduping genuinely distinct occurrences under one key.
    const auditIdempotencyKey =
      outcome.status === "sent"
        ? `asana-task-nudge-sent:${updatedId}`
        : `asana-task-nudge-failed:${updatedId}:${randomUUID()}`;

    await client.query(
      `insert into audit_events (
         id, organization_id, actor_membership_id, actor_kind, event_type, event_schema_version,
         subject_type, subject_id, correlation_id, idempotency_key, outcome,
         payload_digest, event_digest, metadata, retention_class, retain_until, occurred_at
       ) values (
         $1, $2, $3, 'user', $4, 1, 'asana_task_nudge', $5, $6, $7, $8,
         $9, $10, $11::jsonb, $12, now() + $13::interval, now()
       )`,
      [
        auditEventId,
        organizationId,
        membershipId,
        eventType,
        updatedId,
        auditIdempotencyKey,
        auditIdempotencyKey,
        outcome.status === "sent" ? "succeeded" : "failed",
        payloadDigest,
        eventDigest,
        metadata,
        STANDARD_AUDIT_RETENTION_CLASS,
        STANDARD_AUDIT_RETENTION_INTERVAL,
      ],
    );
  });
}
