import { createHash, randomUUID } from "node:crypto";

import {
  STANDARD_AUDIT_RETENTION_CLASS,
  STANDARD_AUDIT_RETENTION_INTERVAL,
} from "./audit-retention";
import type { DatabasePool } from "./client";
import { resolveMembershipId } from "./membership";
import { withTenantContext } from "./tenant-context";

/**
 * The Safe Action pattern's second real write path (ADR 0056), alongside
 * `internal-tasks.ts` — but the real side effect (the Gmail API call)
 * happens between `beginCustomerEmailReplySend` and
 * `completeCustomerEmailReplySend`, outside any one DB transaction, so a
 * row's status is a durable lifecycle rather than a single insert.
 *
 * Disclosed limitation: if the process crashes after Gmail accepts the
 * send but before `completeCustomerEmailReplySend` commits, the row is
 * left `'pending'` with no way to know whether the email actually went
 * out. `beginCustomerEmailReplySend` treats a pre-existing `'pending'` row
 * as unsafe to auto-retry — it returns `alreadyResolved: "pending"` and the
 * caller must surface a manual check, never silently resend. A `'failed'`
 * row (Gmail was never reached successfully) is reset to `'pending'` and
 * is safe to retry on the same row.
 */

export interface BeginCustomerEmailReplySendInput {
  readonly userId: string;
  readonly agentCollaborationId: string;
  readonly messageId: string;
  readonly toEmail: string;
  readonly subject: string;
  readonly body: string;
  readonly idempotencyKey: string;
}

export type BeginCustomerEmailReplySendResult =
  | { readonly id: string; readonly alreadyResolved: null }
  | { readonly id: string; readonly alreadyResolved: "pending" }
  | {
      readonly id: string;
      readonly alreadyResolved: "sent";
      readonly gmailMessageId: string;
      readonly gmailThreadId: string;
    };

interface CustomerEmailReplyStatusRow {
  readonly id: string;
  readonly status: string;
  readonly gmail_message_id: string | null;
  readonly gmail_thread_id: string | null;
}

/**
 * Begins (or resumes) one send attempt. Returns the row id the caller must
 * pass to `completeCustomerEmailReplySend`, plus whether this is a fresh
 * attempt (`alreadyResolved: null` — safe to call Gmail) or a replay the
 * caller must not re-execute (`"sent"`/`"pending"`).
 */
export async function beginCustomerEmailReplySend(
  pool: DatabasePool,
  organizationId: string,
  input: BeginCustomerEmailReplySendInput,
): Promise<BeginCustomerEmailReplySendResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const membershipId = await resolveMembershipId(
      client,
      organizationId,
      input.userId,
    );

    const insertResult = await client.query<{ id: string }>(
      `insert into customer_email_replies (
         id, organization_id, agent_collaboration_id, message_id,
         triggered_by_membership_id, idempotency_key, to_email, subject, body
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (organization_id, idempotency_key) do nothing
       returning id`,
      [
        randomUUID(),
        organizationId,
        input.agentCollaborationId,
        input.messageId,
        membershipId,
        input.idempotencyKey,
        input.toEmail,
        input.subject,
        input.body,
      ],
    );

    const inserted = insertResult.rows[0];

    if (inserted) {
      return { id: inserted.id, alreadyResolved: null };
    }

    // A prior call with this exact idempotency key already created a row —
    // resolve what should happen next from its current status.
    const existingResult = await client.query<CustomerEmailReplyStatusRow>(
      `select id, status, gmail_message_id, gmail_thread_id
       from customer_email_replies
       where organization_id = $1 and idempotency_key = $2`,
      [organizationId, input.idempotencyKey],
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      throw new Error(
        "customer_email_replies idempotency conflict but no existing row found",
      );
    }

    if (existing.status === "sent") {
      if (!existing.gmail_message_id || !existing.gmail_thread_id) {
        throw new Error(
          `customer_email_replies row ${existing.id} is 'sent' but missing its gmail message/thread id`,
        );
      }

      return {
        id: existing.id,
        alreadyResolved: "sent",
        gmailMessageId: existing.gmail_message_id,
        gmailThreadId: existing.gmail_thread_id,
      };
    }

    if (existing.status === "pending") {
      return { id: existing.id, alreadyResolved: "pending" };
    }

    // status === "failed": Gmail was never reached successfully, so this
    // row is safe to retry — reset it to 'pending' rather than leaving it
    // stuck, so completeCustomerEmailReplySend's "only transition a
    // currently-pending row" guard still applies to the retry.
    await client.query(
      `update customer_email_replies
       set status = 'pending', failure_reason = null, updated_at = now()
       where organization_id = $1 and id = $2`,
      [organizationId, existing.id],
    );

    return { id: existing.id, alreadyResolved: null };
  });
}

/**
 * The most recent successful send for this message, or `null` if none
 * exists — the real fact `runPreFlightPolicyAudit`'s duplicate-send-window
 * check needs (`apps/web/app/_lib/pre-flight-policy-audit.ts`, ADR 0058).
 * Reads only `'sent'` rows: a `'pending'`/`'failed'` attempt never actually
 * reached the customer, so it has no bearing on whether a fresh send would
 * double-message them.
 */
export async function getMostRecentCustomerEmailReplySentAt(
  pool: DatabasePool,
  organizationId: string,
  messageId: string,
): Promise<Date | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ sent_at: Date }>(
      `select sent_at
       from customer_email_replies
       where organization_id = $1 and message_id = $2 and status = 'sent'
       order by sent_at desc
       limit 1`,
      [organizationId, messageId],
    );

    return result.rows[0]?.sent_at ?? null;
  });
}

export type CompleteCustomerEmailReplySendOutcome =
  | {
      readonly status: "sent";
      readonly gmailMessageId: string;
      readonly gmailThreadId: string;
    }
  | { readonly status: "failed"; readonly failureReason: string };

/**
 * Records the real outcome of a Gmail send attempt — status update and
 * audit event in one transaction, the same mutation-plus-audit shape
 * `internal-tasks.ts` uses, applied here to a status transition since the
 * real external side effect already happened by the time this is called.
 *
 * Guarded by `where status = 'pending'`, mirroring `completeInternalTask`'s
 * "the UPDATE only ever matches a row still eligible for this transition"
 * idempotency doctrine: a repeat call for a row that already transitioned
 * away from 'pending' updates nothing and writes no new audit event, since
 * nothing new actually happened.
 */
export async function completeCustomerEmailReplySend(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  replyId: string,
  outcome: CompleteCustomerEmailReplySendOutcome,
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
            `update customer_email_replies
             set status = 'sent', gmail_message_id = $3, gmail_thread_id = $4,
                 sent_at = now(), updated_at = now()
             where organization_id = $1 and id = $2 and status = 'pending'
             returning id`,
            [
              organizationId,
              replyId,
              outcome.gmailMessageId,
              outcome.gmailThreadId,
            ],
          )
        : await client.query<{ id: string }>(
            `update customer_email_replies
             set status = 'failed', failure_reason = $3, updated_at = now()
             where organization_id = $1 and id = $2 and status = 'pending'
             returning id`,
            [organizationId, replyId, outcome.failureReason],
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
        ? "customer_email_reply.sent"
        : "customer_email_reply.failed";
    const metadata = JSON.stringify(
      outcome.status === "sent"
        ? {
            gmailMessageId: outcome.gmailMessageId,
            gmailThreadId: outcome.gmailThreadId,
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
        ? `customer-email-reply-sent:${updatedId}`
        : `customer-email-reply-failed:${updatedId}:${randomUUID()}`;

    await client.query(
      `insert into audit_events (
         id, organization_id, actor_membership_id, actor_kind, event_type, event_schema_version,
         subject_type, subject_id, correlation_id, idempotency_key, outcome,
         payload_digest, event_digest, metadata, retention_class, retain_until, occurred_at
       ) values (
         $1, $2, $3, 'user', $4, 1, 'customer_email_reply', $5, $6, $7, $8,
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
