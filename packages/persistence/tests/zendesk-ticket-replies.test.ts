import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startAgentCollaboration } from "../src/agent-collaborations";
import type { DatabasePool } from "../src/client";
import { withTenantContext } from "../src/tenant-context";
import { ingestZendeskTicket } from "../src/zendesk-sync";
import {
  beginZendeskTicketReplySend,
  completeZendeskTicketReplySend,
} from "../src/zendesk-ticket-replies";
import {
  getTestPool,
  seedIntegration,
  seedMembership,
  seedSyncJob,
} from "./support";

async function seedCollaborationForTicket(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  supportTicketId: string,
  idempotencyKey: string,
): Promise<{ id: string }> {
  const collaboration = await startAgentCollaboration(pool, organizationId, {
    userId,
    pattern: "single_specialist",
    objective: "Draft a reply to this support ticket.",
    correlationId: idempotencyKey,
    idempotencyKey,
    supportTicketId,
  });

  return { id: collaboration.id };
}

describe.skipIf(!process.env.DATABASE_URL)(
  "zendesk ticket replies (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    async function seedFixture(idempotencyKey: string) {
      const { organizationId, userId } = await seedMembership(pool);
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "zendesk",
      });
      const job = await seedSyncJob(
        pool,
        organizationId,
        integration.id,
        "zendesk",
        "support_ticket",
      );
      const ingested = await ingestZendeskTicket(
        pool,
        organizationId,
        integration.id,
        {
          externalRecordId: `ticket-${randomUUID()}`,
          sourceVersion: "v1",
          rawPayloadSha256: "c".repeat(64),
          rawPayloadByteLength: 10,
          observedAt: new Date(),
          subject: "Can't log in",
          status: "open",
          priority: null,
          requesterName: null,
          assigneeName: null,
          dueAt: null,
          lastActivityAt: new Date(),
          syncJobId: job.id,
        },
      );
      const supportTicketId = ingested.ticketId!;
      const collaboration = await seedCollaborationForTicket(
        pool,
        organizationId,
        userId,
        supportTicketId,
        `${idempotencyKey}:collaboration`,
      );

      return { organizationId, userId, supportTicketId, collaboration };
    }

    it("begins a fresh send as 'pending'", async () => {
      const { organizationId, userId, supportTicketId, collaboration } =
        await seedFixture("begin-fresh");

      const result = await beginZendeskTicketReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        supportTicketId,
        body: "Please try resetting your password from the login page.",
        idempotencyKey: "begin-fresh:send",
      });

      expect(result.alreadyResolved).toBeNull();

      const row = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const queryResult = await client.query(
            "select status, body from zendesk_ticket_replies where id = $1",
            [result.id],
          );
          return queryResult.rows[0];
        },
      );

      expect(row).toEqual({
        status: "pending",
        body: "Please try resetting your password from the login page.",
      });
    });

    it("returns alreadyResolved 'pending' on a replay while still pending — never a second Zendesk call", async () => {
      const { organizationId, userId, supportTicketId, collaboration } =
        await seedFixture("begin-pending-replay");

      const first = await beginZendeskTicketReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        supportTicketId,
        body: "Thanks for reaching out — looking into this now.",
        idempotencyKey: "begin-pending-replay:send",
      });
      const second = await beginZendeskTicketReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        supportTicketId,
        body: "Thanks for reaching out — looking into this now.",
        idempotencyKey: "begin-pending-replay:send",
      });

      expect(first.id).toBe(second.id);
      expect(second.alreadyResolved).toBe("pending");
    });

    it("completes a send as 'sent' with a real, correctly attributed audit event", async () => {
      const { organizationId, userId, supportTicketId, collaboration } =
        await seedFixture("complete-sent");

      const begun = await beginZendeskTicketReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        supportTicketId,
        body: "Please try resetting your password from the login page.",
        idempotencyKey: "complete-sent:send",
      });

      const sentAt = new Date();
      await completeZendeskTicketReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "sent", sentAt },
      );

      const [replyRow, auditRows] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const replyResult = await client.query(
            "select status, sent_at from zendesk_ticket_replies where id = $1",
            [begun.id],
          );
          const auditResult = await client.query(
            "select event_type, outcome, actor_kind, subject_id from audit_events where subject_id = $1",
            [begun.id],
          );
          return [replyResult.rows[0], auditResult.rows];
        },
      );

      expect(replyRow.status).toBe("sent");
      expect(replyRow.sent_at).toBeInstanceOf(Date);

      expect(auditRows).toHaveLength(1);
      expect(auditRows[0]).toEqual({
        event_type: "zendesk_ticket_reply.sent",
        outcome: "succeeded",
        actor_kind: "user",
        subject_id: begun.id,
      });
    });

    it("a repeat completeZendeskTicketReplySend call after 'sent' is a no-op — no duplicate audit event", async () => {
      const { organizationId, userId, supportTicketId, collaboration } =
        await seedFixture("complete-sent-repeat");

      const begun = await beginZendeskTicketReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        supportTicketId,
        body: "Thanks for reaching out — looking into this now.",
        idempotencyKey: "complete-sent-repeat:send",
      });

      const sentAt = new Date();
      await completeZendeskTicketReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "sent", sentAt },
      );
      // A second call for the same row, as if the server action retried
      // after a dropped response.
      await completeZendeskTicketReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "sent", sentAt },
      );

      const auditRows = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select id from audit_events where subject_id = $1 and event_type = 'zendesk_ticket_reply.sent'",
            [begun.id],
          );
          return result.rows;
        },
      );

      expect(auditRows).toHaveLength(1);
    });

    it("returns alreadyResolved 'sent' with the real sentAt on replay after a successful send", async () => {
      const { organizationId, userId, supportTicketId, collaboration } =
        await seedFixture("begin-sent-replay");

      const begun = await beginZendeskTicketReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        supportTicketId,
        body: "Thanks for reaching out — looking into this now.",
        idempotencyKey: "begin-sent-replay:send",
      });
      const sentAt = new Date();
      await completeZendeskTicketReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "sent", sentAt },
      );

      const replay = await beginZendeskTicketReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        supportTicketId,
        body: "Thanks for reaching out — looking into this now.",
        idempotencyKey: "begin-sent-replay:send",
      });

      expect(replay.id).toBe(begun.id);
      expect(replay.alreadyResolved).toBe("sent");
      expect(replay.alreadyResolved === "sent" ? replay.sentAt : null).toEqual(
        sentAt,
      );
    });

    it("completes a send as 'failed' with a real audit event, and resets to 'pending' on retry", async () => {
      const { organizationId, userId, supportTicketId, collaboration } =
        await seedFixture("complete-failed");

      const begun = await beginZendeskTicketReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        supportTicketId,
        body: "Thanks for reaching out — looking into this now.",
        idempotencyKey: "complete-failed:send",
      });

      await completeZendeskTicketReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "failed", failureReason: "Zendesk rate limited" },
      );

      const failedRow = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select status, failure_reason from zendesk_ticket_replies where id = $1",
            [begun.id],
          );
          return result.rows[0];
        },
      );
      expect(failedRow).toEqual({
        status: "failed",
        failure_reason: "Zendesk rate limited",
      });

      // Retry: the same idempotency key resets the row to 'pending' rather
      // than leaving it stuck 'failed' forever.
      const retried = await beginZendeskTicketReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        supportTicketId,
        body: "Thanks for reaching out — looking into this now.",
        idempotencyKey: "complete-failed:send",
      });

      expect(retried.id).toBe(begun.id);
      expect(retried.alreadyResolved).toBeNull();

      await completeZendeskTicketReplySend(
        pool,
        organizationId,
        userId,
        retried.id,
        { status: "sent", sentAt: new Date() },
      );

      const [finalRow, auditRows] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const replyResult = await client.query(
            "select status from zendesk_ticket_replies where id = $1",
            [begun.id],
          );
          const auditResult = await client.query(
            "select event_type from audit_events where subject_id = $1 order by occurred_at asc",
            [begun.id],
          );
          return [replyResult.rows[0], auditResult.rows];
        },
      );

      expect(finalRow.status).toBe("sent");
      expect(
        auditRows.map((row: { event_type: string }) => row.event_type),
      ).toEqual(["zendesk_ticket_reply.failed", "zendesk_ticket_reply.sent"]);
    });

    it("lets only one of two concurrent retries of the same failed idempotency key proceed to send — never both", async () => {
      const { organizationId, userId, supportTicketId, collaboration } =
        await seedFixture("concurrent-retry");

      const begun = await beginZendeskTicketReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        supportTicketId,
        body: "Thanks for reaching out — looking into this now.",
        idempotencyKey: "concurrent-retry:send",
      });
      await completeZendeskTicketReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "failed", failureReason: "Zendesk rate limited" },
      );

      // Two concurrent callers both retry the same failed idempotency key —
      // e.g. a UI double-click and a background retry, or two server
      // instances racing the same approval. Regression coverage for the
      // same real bug fixed in customer-email-replies.ts:
      // beginZendeskTicketReplySend's "failed -> pending" reset used to
      // UPDATE unconditionally (no `and status = 'failed'` guard), so both
      // concurrent SELECTs could read 'failed' before either UPDATE
      // committed, and both would return alreadyResolved: null — telling
      // both callers it was safe to call the real Zendesk API, an actual
      // duplicate reply. The fix guards the UPDATE with `and status =
      // 'failed'` and re-checks via RETURNING: the race's loser must see
      // alreadyResolved: 'pending', not null.
      const [first, second] = await Promise.all([
        beginZendeskTicketReplySend(pool, organizationId, {
          userId,
          agentCollaborationId: collaboration.id,
          supportTicketId,
          body: "Thanks for reaching out — looking into this now.",
          idempotencyKey: "concurrent-retry:send",
        }),
        beginZendeskTicketReplySend(pool, organizationId, {
          userId,
          agentCollaborationId: collaboration.id,
          supportTicketId,
          body: "Thanks for reaching out — looking into this now.",
          idempotencyKey: "concurrent-retry:send",
        }),
      ]);

      expect(first.id).toBe(begun.id);
      expect(second.id).toBe(begun.id);

      const resolvedValues = [first.alreadyResolved, second.alreadyResolved];
      // Exactly one caller must be told it's safe to send (null); the other
      // must be told a send is already in flight (pending) — never both
      // null, which would mean two real Zendesk calls for one approval.
      expect(resolvedValues.filter((value) => value === null)).toHaveLength(1);
      expect(
        resolvedValues.filter((value) => value === "pending"),
      ).toHaveLength(1);
    });

    it("does not let one organization begin a send against another's collaboration/ticket", async () => {
      const orgA = await seedFixture("cross-tenant-a");
      const orgB = await seedFixture("cross-tenant-b");

      await expect(
        beginZendeskTicketReplySend(pool, orgA.organizationId, {
          userId: orgA.userId,
          agentCollaborationId: orgB.collaboration.id,
          supportTicketId: orgB.supportTicketId,
          body: "Thanks for reaching out — looking into this now.",
          idempotencyKey: "cross-tenant-attempt",
        }),
      ).rejects.toThrow();
    });
  },
);
