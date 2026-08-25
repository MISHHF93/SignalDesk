import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startAgentCollaboration } from "../src/agent-collaborations";
import type { DatabasePool } from "../src/client";
import {
  beginCustomerEmailReplySend,
  completeCustomerEmailReplySend,
} from "../src/customer-email-replies";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedMembership,
  seedMessage,
  seedSourceRecord,
} from "./support";

async function seedCollaborationForMessage(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  messageId: string,
  idempotencyKey: string,
): Promise<{ id: string }> {
  const collaboration = await startAgentCollaboration(pool, organizationId, {
    userId,
    pattern: "single_specialist",
    objective: "Draft a reply to this message.",
    correlationId: idempotencyKey,
    idempotencyKey,
    messageId,
  });

  return { id: collaboration.id };
}

describe.skipIf(!process.env.DATABASE_URL)(
  "customer email replies (live database)",
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
        sourceSystem: "gmail",
      });
      const sourceRecord = await seedSourceRecord(
        pool,
        organizationId,
        integration.id,
        integration.sourceSystem,
      );
      const message = await seedMessage(pool, organizationId, sourceRecord.id);
      const collaboration = await seedCollaborationForMessage(
        pool,
        organizationId,
        userId,
        message.id,
        `${idempotencyKey}:collaboration`,
      );

      return { organizationId, userId, message, collaboration };
    }

    it("begins a fresh send as 'pending', not resolved yet", async () => {
      const { organizationId, userId, message, collaboration } =
        await seedFixture("begin-fresh");

      const result = await beginCustomerEmailReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        messageId: message.id,
        toEmail: "jane@example.test",
        subject: "Re: Question about my order",
        body: "Your order ships tomorrow.",
        idempotencyKey: "begin-fresh:send",
      });

      expect(result.alreadyResolved).toBeNull();

      const row = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const queryResult = await client.query(
            "select status, to_email, subject, body from customer_email_replies where id = $1",
            [result.id],
          );
          return queryResult.rows[0];
        },
      );

      expect(row).toEqual({
        status: "pending",
        to_email: "jane@example.test",
        subject: "Re: Question about my order",
        body: "Your order ships tomorrow.",
      });
    });

    it("returns alreadyResolved: 'pending' on a replay while still pending — never a second Gmail call", async () => {
      const { organizationId, userId, message, collaboration } =
        await seedFixture("begin-pending-replay");

      const first = await beginCustomerEmailReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        messageId: message.id,
        toEmail: "jane@example.test",
        subject: "Re: hi",
        body: "Thanks.",
        idempotencyKey: "begin-pending-replay:send",
      });
      const second = await beginCustomerEmailReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        messageId: message.id,
        toEmail: "jane@example.test",
        subject: "Re: hi",
        body: "Thanks.",
        idempotencyKey: "begin-pending-replay:send",
      });

      expect(first.id).toBe(second.id);
      expect(second.alreadyResolved).toBe("pending");
    });

    it("completes a send as 'sent' with a real, correctly attributed audit event", async () => {
      const { organizationId, userId, message, collaboration } =
        await seedFixture("complete-sent");

      const begun = await beginCustomerEmailReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        messageId: message.id,
        toEmail: "jane@example.test",
        subject: "Re: Question about my order",
        body: "Your order ships tomorrow.",
        idempotencyKey: "complete-sent:send",
      });

      await completeCustomerEmailReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        {
          status: "sent",
          gmailMessageId: "gmail-msg-1",
          gmailThreadId: "gmail-thread-1",
        },
      );

      const [replyRow, auditRows] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const replyResult = await client.query(
            "select status, gmail_message_id, gmail_thread_id, sent_at from customer_email_replies where id = $1",
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
      expect(replyRow.gmail_message_id).toBe("gmail-msg-1");
      expect(replyRow.gmail_thread_id).toBe("gmail-thread-1");
      expect(replyRow.sent_at).toBeInstanceOf(Date);

      expect(auditRows).toHaveLength(1);
      expect(auditRows[0]).toEqual({
        event_type: "customer_email_reply.sent",
        outcome: "succeeded",
        actor_kind: "user",
        subject_id: begun.id,
      });
    });

    it("a repeat completeCustomerEmailReplySend call after 'sent' is a no-op — no duplicate audit event", async () => {
      const { organizationId, userId, message, collaboration } =
        await seedFixture("complete-sent-repeat");

      const begun = await beginCustomerEmailReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        messageId: message.id,
        toEmail: "jane@example.test",
        subject: "Re: hi",
        body: "Thanks.",
        idempotencyKey: "complete-sent-repeat:send",
      });

      await completeCustomerEmailReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        {
          status: "sent",
          gmailMessageId: "gmail-msg-2",
          gmailThreadId: "gmail-thread-2",
        },
      );
      // A second call for the same row, as if the server action retried
      // after a dropped response.
      await completeCustomerEmailReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        {
          status: "sent",
          gmailMessageId: "gmail-msg-2",
          gmailThreadId: "gmail-thread-2",
        },
      );

      const auditRows = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select id from audit_events where subject_id = $1 and event_type = 'customer_email_reply.sent'",
            [begun.id],
          );
          return result.rows;
        },
      );

      expect(auditRows).toHaveLength(1);
    });

    it("returns alreadyResolved: 'sent' with the real gmail ids on replay after a successful send", async () => {
      const { organizationId, userId, message, collaboration } =
        await seedFixture("begin-sent-replay");

      const begun = await beginCustomerEmailReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        messageId: message.id,
        toEmail: "jane@example.test",
        subject: "Re: hi",
        body: "Thanks.",
        idempotencyKey: "begin-sent-replay:send",
      });
      await completeCustomerEmailReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        {
          status: "sent",
          gmailMessageId: "gmail-msg-3",
          gmailThreadId: "gmail-thread-3",
        },
      );

      const replay = await beginCustomerEmailReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        messageId: message.id,
        toEmail: "jane@example.test",
        subject: "Re: hi",
        body: "Thanks.",
        idempotencyKey: "begin-sent-replay:send",
      });

      expect(replay).toEqual({
        id: begun.id,
        alreadyResolved: "sent",
        gmailMessageId: "gmail-msg-3",
        gmailThreadId: "gmail-thread-3",
      });
    });

    it("completes a send as 'failed' with a real audit event, and resets to 'pending' on retry", async () => {
      const { organizationId, userId, message, collaboration } =
        await seedFixture("complete-failed");

      const begun = await beginCustomerEmailReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        messageId: message.id,
        toEmail: "jane@example.test",
        subject: "Re: hi",
        body: "Thanks.",
        idempotencyKey: "complete-failed:send",
      });

      await completeCustomerEmailReplySend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "failed", failureReason: "Gmail rate limited" },
      );

      const failedRow = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select status, failure_reason from customer_email_replies where id = $1",
            [begun.id],
          );
          return result.rows[0];
        },
      );
      expect(failedRow).toEqual({
        status: "failed",
        failure_reason: "Gmail rate limited",
      });

      // Retry: the same idempotency key resets the row to 'pending' rather
      // than leaving it stuck 'failed' forever.
      const retried = await beginCustomerEmailReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        messageId: message.id,
        toEmail: "jane@example.test",
        subject: "Re: hi",
        body: "Thanks.",
        idempotencyKey: "complete-failed:send",
      });

      expect(retried.id).toBe(begun.id);
      expect(retried.alreadyResolved).toBeNull();

      await completeCustomerEmailReplySend(
        pool,
        organizationId,
        userId,
        retried.id,
        {
          status: "sent",
          gmailMessageId: "gmail-msg-4",
          gmailThreadId: "gmail-thread-4",
        },
      );

      const [finalRow, auditRows] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const replyResult = await client.query(
            "select status from customer_email_replies where id = $1",
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
      ).toEqual(["customer_email_reply.failed", "customer_email_reply.sent"]);
    });

    it("does not let one organization begin a send against another's collaboration/message", async () => {
      const orgA = await seedFixture("cross-tenant-a");
      const orgB = await seedFixture("cross-tenant-b");

      await expect(
        beginCustomerEmailReplySend(pool, orgA.organizationId, {
          userId: orgA.userId,
          agentCollaborationId: orgB.collaboration.id,
          messageId: orgB.message.id,
          toEmail: "jane@example.test",
          subject: "Re: hi",
          body: "Thanks.",
          idempotencyKey: "cross-tenant-attempt",
        }),
      ).rejects.toThrow();
    });
  },
);
