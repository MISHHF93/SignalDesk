import { createHash, randomUUID } from "node:crypto";

import {
  STANDARD_AUDIT_RETENTION_CLASS,
  STANDARD_AUDIT_RETENTION_INTERVAL,
} from "./audit-retention";
import type { DatabasePool } from "./client";
import { resolveMembershipId } from "./membership";
import { withTenantContext } from "./tenant-context";

/**
 * The Safe Action pattern's sixth real write path (ADR 0057), mirroring
 * `customer-email-replies.ts` exactly: the real side effect (the Zendesk
 * ticket-comment API call) happens between `beginZendeskTicketReplySend`
 * and `completeZendeskTicketReplySend`, outside any one DB transaction, so
 * a row's status is a durable lifecycle rather than a single insert.
 *
 * Disclosed limitation, same shape as the Gmail case: if the process
 * crashes after Zendesk accepts the reply but before
 * `completeZendeskTicketReplySend` commits, the row is left `'pending'`
 * with no way to know whether the reply actually posted.
 * `beginZendeskTicketReplySend` treats a pre-existing `'pending'` row as
 * unsafe to auto-retry — it returns `alreadyResolved: "pending"` and the
 * caller must surface a manual check, never silently resend. A `'failed'`
 * row (Zendesk was never reached successfully) is reset to `'pending'`
 * and is safe to retry on the same row.
 *
 * Body-only — a Zendesk ticket reply has no subject line. Like QuickBooks,
 * Zendesk's ticket-update response does not reliably return a distinct,
 * storable comment identifier separate from the ticket itself, so there
 * is no external-id column on this table. `status` + `sent_at` is the
 * real, honest send evidence kept here instead, and that's what a `'sent'`
 * conflict resolution returns.
 */

export interface BeginZendeskTicketReplySendInput {
  readonly userId: string;
  readonly agentCollaborationId: string;
  readonly supportTicketId: string;
  readonly body: string;
  readonly idempotencyKey: string;
}

export type BeginZendeskTicketReplySendResult =
  | { readonly id: string; readonly alreadyResolved: null }
  | { readonly id: string; readonly alreadyResolved: "pending" }
  | {
      readonly id: string;
      readonly alreadyResolved: "sent";
      readonly sentAt: Date;
    };

interface ZendeskTicketReplyStatusRow {
  readonly id: string;
  readonly status: string;
  readonly sent_at: Date | null;
}

/**
 * Begins (or resumes) one send attempt. Returns the row id the caller must
 * pass to `completeZendeskTicketReplySend`, plus whether this is a fresh
 * attempt (`alreadyResolved: null` — safe to call Zendesk) or a replay the
 * caller must not re-execute (`"sent"`/`"pending"`).
 */
export async function beginZendeskTicketReplySend(
  pool: DatabasePool,
  organizationId: string,
  input: BeginZendeskTicketReplySendInput,
): Promise<BeginZendeskTicketReplySendResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const membershipId = await resolveMembershipId(
      client,
      organizationId,
      input.userId,
    );

    const insertResult = await client.query<{ id: string }>(
      `insert into zendesk_ticket_replies (
         id, organization_id, agent_collaboration_id, support_ticket_id,
         triggered_by_membership_id, idempotency_key, body
       ) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (organization_id, idempotency_key) do nothing
       returning id`,
      [
        randomUUID(),
        organizationId,
        input.agentCollaborationId,
        input.supportTicketId,
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
    const existingResult = await client.query<ZendeskTicketReplyStatusRow>(
      `select id, status, sent_at
       from zendesk_ticket_replies
       where organization_id = $1 and idempotency_key = $2`,
      [organizationId, input.idempotencyKey],
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      throw new Error(
        "zendesk_ticket_replies idempotency conflict but no existing row found",
      );
    }

    if (existing.status === "sent") {
      if (!existing.sent_at) {
        throw new Error(
          `zendesk_ticket_replies row ${existing.id} is 'sent' but missing its sent_at`,
        );
      }

      return {
        id: existing.id,
        alreadyResolved: "sent",
        sentAt: existing.sent_at,
      };
    }

    if (existing.status === "pending") {
      return { id: existing.id, alreadyResolved: "pending" };
    }

    // status === "failed": Zendesk was never reached successfully, so this
    // row is safe to retry — reset it to 'pending' rather than leaving it
    // stuck, so completeZendeskTicketReplySend's "only transition a
    // currently-pending row" guard still applies to the retry. Guarded by
    // `and status = 'failed'` and re-checked via RETURNING — see
    // customer-email-replies.ts's identical fix for why: without this,
    // two concurrent retries of the same failed idempotency key could both
    // read 'failed' before either UPDATE commits and both call the real
    // Zendesk API. If this UPDATE affects zero rows, another concurrent
    // call already won that race and is now responsible for the real send.
    const resetResult = await client.query<{ id: string }>(
      `update zendesk_ticket_replies
       set status = 'pending', failure_reason = null, updated_at = now()
       where organization_id = $1 and id = $2 and status = 'failed'
       returning id`,
      [organizationId, existing.id],
    );

    if (resetResult.rows[0]) {
      return { id: existing.id, alreadyResolved: null };
    }

    return { id: existing.id, alreadyResolved: "pending" };
  });
}

/**
 * The most recent successful send for this ticket, or `null` if none
 * exists — the real fact `runPreFlightPolicyAudit`'s duplicate-send-window
 * check needs (`apps/web/app/_lib/pre-flight-policy-audit.ts`, ADR 0058).
 * Reads only `'sent'` rows: a `'pending'`/`'failed'` attempt never actually
 * reached the customer, so it has no bearing on whether a fresh reply
 * would double-message them.
 */
export async function getMostRecentZendeskTicketReplySentAt(
  pool: DatabasePool,
  organizationId: string,
  supportTicketId: string,
): Promise<Date | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ sent_at: Date }>(
      `select sent_at
       from zendesk_ticket_replies
       where organization_id = $1 and support_ticket_id = $2 and status = 'sent'
       order by sent_at desc
       limit 1`,
      [organizationId, supportTicketId],
    );

    return result.rows[0]?.sent_at ?? null;
  });
}

export type CompleteZendeskTicketReplySendOutcome =
  | { readonly status: "sent"; readonly sentAt: Date }
  | { readonly status: "failed"; readonly failureReason: string };

/**
 * Records the real outcome of a Zendesk ticket-comment attempt — status
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
export async function completeZendeskTicketReplySend(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  replyId: string,
  outcome: CompleteZendeskTicketReplySendOutcome,
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
            `update zendesk_ticket_replies
             set status = 'sent', sent_at = $3, updated_at = now()
             where organization_id = $1 and id = $2 and status = 'pending'
             returning id`,
            [organizationId, replyId, outcome.sentAt],
          )
        : await client.query<{ id: string }>(
            `update zendesk_ticket_replies
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
        ? "zendesk_ticket_reply.sent"
        : "zendesk_ticket_reply.failed";
    const metadata = JSON.stringify(
      outcome.status === "sent"
        ? { sentAt: outcome.sentAt.toISOString() }
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
        ? `zendesk-ticket-reply-sent:${updatedId}`
        : `zendesk-ticket-reply-failed:${updatedId}:${randomUUID()}`;

    await client.query(
      `insert into audit_events (
         id, organization_id, actor_membership_id, actor_kind, event_type, event_schema_version,
         subject_type, subject_id, correlation_id, idempotency_key, outcome,
         payload_digest, event_digest, metadata, retention_class, retain_until, occurred_at
       ) values (
         $1, $2, $3, 'user', $4, 1, 'zendesk_ticket_reply', $5, $6, $7, $8,
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
