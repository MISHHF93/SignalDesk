import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startAgentCollaboration } from "../src/agent-collaborations";
import type { DatabasePool } from "../src/client";
import { ingestQuickBooksInvoice } from "../src/invoices";
import {
  beginQuickBooksInvoiceReminderSend,
  completeQuickBooksInvoiceReminderSend,
} from "../src/quickbooks-invoice-reminders";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedMembership,
  seedSyncJob,
} from "./support";

async function seedCollaborationForInvoice(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  invoiceId: string,
  idempotencyKey: string,
): Promise<{ id: string }> {
  const collaboration = await startAgentCollaboration(pool, organizationId, {
    userId,
    pattern: "single_specialist",
    objective: "Draft a QuickBooks invoice-payment reminder.",
    correlationId: idempotencyKey,
    idempotencyKey,
    invoiceId,
  });

  return { id: collaboration.id };
}

describe.skipIf(!process.env.DATABASE_URL)(
  "quickbooks invoice reminders (live database)",
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
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        organizationId,
        integration.id,
        "quickbooks",
        "invoice",
      );
      const ingested = await ingestQuickBooksInvoice(
        pool,
        organizationId,
        integration.id,
        {
          externalRecordId: `inv-${randomUUID()}`,
          sourceVersion: "v1",
          rawPayloadSha256: "c".repeat(64),
          rawPayloadByteLength: 10,
          observedAt: new Date(),
          customerName: "Acme Robotics",
          amountCents: 50_00,
          currency: "USD",
          dueAt: new Date(),
          status: "open",
          syncJobId: job.id,
        },
      );
      const invoiceId = ingested.invoiceId!;
      const collaboration = await seedCollaborationForInvoice(
        pool,
        organizationId,
        userId,
        invoiceId,
        `${idempotencyKey}:collaboration`,
      );

      return { organizationId, userId, invoiceId, collaboration };
    }

    it("begins a fresh send as 'pending', not resolved yet", async () => {
      const { organizationId, userId, invoiceId, collaboration } =
        await seedFixture("begin-fresh");

      const result = await beginQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Your invoice is due soon — please remit payment.",
          idempotencyKey: "begin-fresh:send",
        },
      );

      expect(result.alreadyResolved).toBeNull();

      const row = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const queryResult = await client.query(
            "select status, subject, body from quickbooks_invoice_reminders where id = $1",
            [result.id],
          );
          return queryResult.rows[0];
        },
      );

      expect(row).toEqual({
        status: "pending",
        subject: "Reminder: Invoice payment due",
        body: "Your invoice is due soon — please remit payment.",
      });
    });

    it("returns alreadyResolved: 'pending' on a replay while still pending — never a second QuickBooks call", async () => {
      const { organizationId, userId, invoiceId, collaboration } =
        await seedFixture("begin-pending-replay");

      const first = await beginQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "begin-pending-replay:send",
        },
      );
      const second = await beginQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "begin-pending-replay:send",
        },
      );

      expect(first.id).toBe(second.id);
      expect(second.alreadyResolved).toBe("pending");
    });

    it("completes a send as 'sent' with a real, correctly attributed audit event", async () => {
      const { organizationId, userId, invoiceId, collaboration } =
        await seedFixture("complete-sent");

      const begun = await beginQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Your invoice is due soon — please remit payment.",
          idempotencyKey: "complete-sent:send",
        },
      );

      const sentAt = new Date();
      await completeQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "sent", sentAt },
      );

      const [reminderRow, auditRows] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const reminderResult = await client.query(
            "select status, sent_at from quickbooks_invoice_reminders where id = $1",
            [begun.id],
          );
          const auditResult = await client.query(
            "select event_type, outcome, actor_kind, subject_id from audit_events where subject_id = $1",
            [begun.id],
          );
          return [reminderResult.rows[0], auditResult.rows];
        },
      );

      expect(reminderRow.status).toBe("sent");
      expect(reminderRow.sent_at).toBeInstanceOf(Date);

      expect(auditRows).toHaveLength(1);
      expect(auditRows[0]).toEqual({
        event_type: "quickbooks_invoice_reminder.sent",
        outcome: "succeeded",
        actor_kind: "user",
        subject_id: begun.id,
      });
    });

    it("a repeat completeQuickBooksInvoiceReminderSend call after 'sent' is a no-op — no duplicate audit event", async () => {
      const { organizationId, userId, invoiceId, collaboration } =
        await seedFixture("complete-sent-repeat");

      const begun = await beginQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "complete-sent-repeat:send",
        },
      );

      const sentAt = new Date();
      await completeQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "sent", sentAt },
      );
      // A second call for the same row, as if the server action retried
      // after a dropped response.
      await completeQuickBooksInvoiceReminderSend(
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
            "select id from audit_events where subject_id = $1 and event_type = 'quickbooks_invoice_reminder.sent'",
            [begun.id],
          );
          return result.rows;
        },
      );

      expect(auditRows).toHaveLength(1);
    });

    it("returns alreadyResolved: 'sent' with the real sentAt on replay after a successful send", async () => {
      const { organizationId, userId, invoiceId, collaboration } =
        await seedFixture("begin-sent-replay");

      const begun = await beginQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "begin-sent-replay:send",
        },
      );
      const sentAt = new Date();
      await completeQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "sent", sentAt },
      );

      const replay = await beginQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "begin-sent-replay:send",
        },
      );

      expect(replay.id).toBe(begun.id);
      expect(replay.alreadyResolved).toBe("sent");
      expect(replay.alreadyResolved === "sent" ? replay.sentAt : null).toEqual(
        sentAt,
      );
    });

    it("completes a send as 'failed' with a real audit event, and resets to 'pending' on retry", async () => {
      const { organizationId, userId, invoiceId, collaboration } =
        await seedFixture("complete-failed");

      const begun = await beginQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "complete-failed:send",
        },
      );

      await completeQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "failed", failureReason: "QuickBooks rate limited" },
      );

      const failedRow = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select status, failure_reason from quickbooks_invoice_reminders where id = $1",
            [begun.id],
          );
          return result.rows[0];
        },
      );
      expect(failedRow).toEqual({
        status: "failed",
        failure_reason: "QuickBooks rate limited",
      });

      // Retry: the same idempotency key resets the row to 'pending' rather
      // than leaving it stuck 'failed' forever.
      const retried = await beginQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "complete-failed:send",
        },
      );

      expect(retried.id).toBe(begun.id);
      expect(retried.alreadyResolved).toBeNull();

      await completeQuickBooksInvoiceReminderSend(
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
          const reminderResult = await client.query(
            "select status from quickbooks_invoice_reminders where id = $1",
            [begun.id],
          );
          const auditResult = await client.query(
            "select event_type from audit_events where subject_id = $1 order by occurred_at asc",
            [begun.id],
          );
          return [reminderResult.rows[0], auditResult.rows];
        },
      );

      expect(finalRow.status).toBe("sent");
      expect(
        auditRows.map((row: { event_type: string }) => row.event_type),
      ).toEqual([
        "quickbooks_invoice_reminder.failed",
        "quickbooks_invoice_reminder.sent",
      ]);
    });

    it("lets only one of two concurrent retries of the same failed idempotency key proceed to send — never both", async () => {
      const { organizationId, userId, invoiceId, collaboration } =
        await seedFixture("concurrent-retry");

      const begun = await beginQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "concurrent-retry:send",
        },
      );
      await completeQuickBooksInvoiceReminderSend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "failed", failureReason: "QuickBooks rate limited" },
      );

      // Two concurrent callers both retry the same failed idempotency key —
      // e.g. a UI double-click and a background retry, or two server
      // instances racing the same approval. Regression coverage for the
      // same real bug fixed in customer-email-replies.ts:
      // beginQuickBooksInvoiceReminderSend's "failed -> pending" reset used
      // to UPDATE unconditionally (no `and status = 'failed'` guard), so
      // both concurrent SELECTs could read 'failed' before either UPDATE
      // committed, and both would return alreadyResolved: null — telling
      // both callers it was safe to call the real QuickBooks API, an actual
      // duplicate send. The fix guards the UPDATE with `and status =
      // 'failed'` and re-checks via RETURNING: the race's loser must see
      // alreadyResolved: 'pending', not null.
      const [first, second] = await Promise.all([
        beginQuickBooksInvoiceReminderSend(pool, organizationId, {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "concurrent-retry:send",
        }),
        beginQuickBooksInvoiceReminderSend(pool, organizationId, {
          userId,
          agentCollaborationId: collaboration.id,
          invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "concurrent-retry:send",
        }),
      ]);

      expect(first.id).toBe(begun.id);
      expect(second.id).toBe(begun.id);

      const resolvedValues = [first.alreadyResolved, second.alreadyResolved];
      // Exactly one caller must be told it's safe to send (null); the other
      // must be told a send is already in flight (pending) — never both
      // null, which would mean two real QuickBooks calls for one approval.
      expect(resolvedValues.filter((value) => value === null)).toHaveLength(1);
      expect(
        resolvedValues.filter((value) => value === "pending"),
      ).toHaveLength(1);
    });

    it("does not let one organization begin a send against another's collaboration/invoice", async () => {
      const orgA = await seedFixture("cross-tenant-a");
      const orgB = await seedFixture("cross-tenant-b");

      await expect(
        beginQuickBooksInvoiceReminderSend(pool, orgA.organizationId, {
          userId: orgA.userId,
          agentCollaborationId: orgB.collaboration.id,
          invoiceId: orgB.invoiceId,
          subject: "Reminder: Invoice payment due",
          body: "Please remit payment at your earliest convenience.",
          idempotencyKey: "cross-tenant-attempt",
        }),
      ).rejects.toThrow();
    });
  },
);
