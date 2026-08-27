import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startAgentCollaboration } from "../src/agent-collaborations";
import type { DatabasePool } from "../src/client";
import { ingestHubSpotDeal } from "../src/hubspot-sync";
import {
  beginHubSpotDealNoteSend,
  completeHubSpotDealNoteSend,
} from "../src/hubspot-deal-notes";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedMembership,
  seedSyncJob,
} from "./support";

async function seedCollaborationForLead(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  leadId: string,
  idempotencyKey: string,
): Promise<{ id: string }> {
  const collaboration = await startAgentCollaboration(pool, organizationId, {
    userId,
    pattern: "single_specialist",
    objective: "Draft a note on this HubSpot deal.",
    correlationId: idempotencyKey,
    idempotencyKey,
    leadId,
  });

  return { id: collaboration.id };
}

describe.skipIf(!process.env.DATABASE_URL)(
  "hubspot deal notes (live database)",
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
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(
        pool,
        organizationId,
        integration.id,
        "hubspot",
        "lead",
      );
      const ingested = await ingestHubSpotDeal(
        pool,
        organizationId,
        integration.id,
        {
          externalRecordId: `deal-${randomUUID()}`,
          sourceVersion: "v1",
          rawPayloadSha256: "c".repeat(64),
          rawPayloadByteLength: 10,
          observedAt: new Date(),
          contactName: "Real Person",
          companyName: "Real Company",
          stage: "new",
          valueCents: 500000,
          currency: "USD",
          expectedResponseHours: 24,
          sourceCreatedAt: new Date(),
          lastInteractionAt: null,
          syncJobId: job.id,
          ownerName: null,
        },
      );
      const leadId = ingested.leadId!;
      const collaboration = await seedCollaborationForLead(
        pool,
        organizationId,
        userId,
        leadId,
        `${idempotencyKey}:collaboration`,
      );

      return { organizationId, userId, leadId, collaboration };
    }

    it("begins a fresh send as 'pending', not resolved yet", async () => {
      const { organizationId, userId, leadId, collaboration } =
        await seedFixture("begin-fresh");

      const result = await beginHubSpotDealNoteSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        leadId,
        body: "Following up after the demo call.",
        idempotencyKey: "begin-fresh:send",
      });

      expect(result.alreadyResolved).toBeNull();

      const row = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const queryResult = await client.query(
            "select status, body, hubspot_note_id from hubspot_deal_notes where id = $1",
            [result.id],
          );
          return queryResult.rows[0];
        },
      );

      expect(row).toEqual({
        status: "pending",
        body: "Following up after the demo call.",
        hubspot_note_id: null,
      });
    });

    it("returns alreadyResolved: 'pending' on a replay while still pending — never a second HubSpot call", async () => {
      const { organizationId, userId, leadId, collaboration } =
        await seedFixture("begin-pending-replay");

      const first = await beginHubSpotDealNoteSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        leadId,
        body: "Checking in.",
        idempotencyKey: "begin-pending-replay:send",
      });
      const second = await beginHubSpotDealNoteSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        leadId,
        body: "Checking in.",
        idempotencyKey: "begin-pending-replay:send",
      });

      expect(first.id).toBe(second.id);
      expect(second.alreadyResolved).toBe("pending");
    });

    it("completes a send as 'sent' with a real, correctly attributed audit event", async () => {
      const { organizationId, userId, leadId, collaboration } =
        await seedFixture("complete-sent");

      const begun = await beginHubSpotDealNoteSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        leadId,
        body: "Following up after the demo call.",
        idempotencyKey: "complete-sent:send",
      });

      await completeHubSpotDealNoteSend(
        pool,
        organizationId,
        userId,
        begun.id,
        {
          status: "sent",
          sentAt: new Date(),
          noteId: "hubspot-note-1",
        },
      );

      const [noteRow, auditRows] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const noteResult = await client.query(
            "select status, hubspot_note_id, sent_at from hubspot_deal_notes where id = $1",
            [begun.id],
          );
          const auditResult = await client.query(
            "select event_type, outcome, actor_kind, subject_id from audit_events where subject_id = $1",
            [begun.id],
          );
          return [noteResult.rows[0], auditResult.rows];
        },
      );

      expect(noteRow.status).toBe("sent");
      expect(noteRow.hubspot_note_id).toBe("hubspot-note-1");
      expect(noteRow.sent_at).toBeInstanceOf(Date);

      expect(auditRows).toHaveLength(1);
      expect(auditRows[0]).toEqual({
        event_type: "hubspot_deal_note.sent",
        outcome: "succeeded",
        actor_kind: "user",
        subject_id: begun.id,
      });
    });

    it("a repeat completeHubSpotDealNoteSend call after 'sent' is a no-op — no duplicate audit event", async () => {
      const { organizationId, userId, leadId, collaboration } =
        await seedFixture("complete-sent-repeat");

      const begun = await beginHubSpotDealNoteSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        leadId,
        body: "Checking in.",
        idempotencyKey: "complete-sent-repeat:send",
      });

      await completeHubSpotDealNoteSend(
        pool,
        organizationId,
        userId,
        begun.id,
        {
          status: "sent",
          sentAt: new Date(),
          noteId: "hubspot-note-2",
        },
      );
      // A second call for the same row, as if the server action retried
      // after a dropped response.
      await completeHubSpotDealNoteSend(
        pool,
        organizationId,
        userId,
        begun.id,
        {
          status: "sent",
          sentAt: new Date(),
          noteId: "hubspot-note-2",
        },
      );

      const auditRows = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select id from audit_events where subject_id = $1 and event_type = 'hubspot_deal_note.sent'",
            [begun.id],
          );
          return result.rows;
        },
      );

      expect(auditRows).toHaveLength(1);
    });

    it("returns alreadyResolved: 'sent' with the real hubspotNoteId on replay after a successful send", async () => {
      const { organizationId, userId, leadId, collaboration } =
        await seedFixture("begin-sent-replay");

      const begun = await beginHubSpotDealNoteSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        leadId,
        body: "Checking in.",
        idempotencyKey: "begin-sent-replay:send",
      });
      await completeHubSpotDealNoteSend(
        pool,
        organizationId,
        userId,
        begun.id,
        {
          status: "sent",
          sentAt: new Date(),
          noteId: "hubspot-note-3",
        },
      );

      const replay = await beginHubSpotDealNoteSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        leadId,
        body: "Checking in.",
        idempotencyKey: "begin-sent-replay:send",
      });

      expect(replay).toEqual({
        id: begun.id,
        alreadyResolved: "sent",
        hubspotNoteId: "hubspot-note-3",
      });
    });

    it("completes a send as 'failed' with a real audit event, and resets to 'pending' on retry", async () => {
      const { organizationId, userId, leadId, collaboration } =
        await seedFixture("complete-failed");

      const begun = await beginHubSpotDealNoteSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        leadId,
        body: "Checking in.",
        idempotencyKey: "complete-failed:send",
      });

      await completeHubSpotDealNoteSend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "failed", failureReason: "HubSpot rate limited" },
      );

      const failedRow = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select status, failure_reason from hubspot_deal_notes where id = $1",
            [begun.id],
          );
          return result.rows[0];
        },
      );
      expect(failedRow).toEqual({
        status: "failed",
        failure_reason: "HubSpot rate limited",
      });

      // Retry: the same idempotency key resets the row to 'pending' rather
      // than leaving it stuck 'failed' forever.
      const retried = await beginHubSpotDealNoteSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        leadId,
        body: "Checking in.",
        idempotencyKey: "complete-failed:send",
      });

      expect(retried.id).toBe(begun.id);
      expect(retried.alreadyResolved).toBeNull();

      await completeHubSpotDealNoteSend(
        pool,
        organizationId,
        userId,
        retried.id,
        {
          status: "sent",
          sentAt: new Date(),
          noteId: "hubspot-note-4",
        },
      );

      const [finalRow, auditRows] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const noteResult = await client.query(
            "select status from hubspot_deal_notes where id = $1",
            [begun.id],
          );
          const auditResult = await client.query(
            "select event_type from audit_events where subject_id = $1 order by occurred_at asc",
            [begun.id],
          );
          return [noteResult.rows[0], auditResult.rows];
        },
      );

      expect(finalRow.status).toBe("sent");
      expect(
        auditRows.map((row: { event_type: string }) => row.event_type),
      ).toEqual(["hubspot_deal_note.failed", "hubspot_deal_note.sent"]);
    });

    it("lets only one of two concurrent retries of the same failed idempotency key proceed to send — never both", async () => {
      const { organizationId, userId, leadId, collaboration } =
        await seedFixture("concurrent-retry");

      const begun = await beginHubSpotDealNoteSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        leadId,
        body: "Checking in.",
        idempotencyKey: "concurrent-retry:send",
      });
      await completeHubSpotDealNoteSend(
        pool,
        organizationId,
        userId,
        begun.id,
        { status: "failed", failureReason: "HubSpot rate limited" },
      );

      // Two concurrent callers both retry the same failed idempotency key —
      // e.g. a UI double-click and a background retry, or two server
      // instances racing the same approval. Regression coverage for the same
      // class of bug customer-email-replies.ts's identical test guards:
      // beginHubSpotDealNoteSend's "failed -> pending" reset UPDATE is
      // guarded by `and status = 'failed'` and re-checked via RETURNING, so
      // the race's loser must see alreadyResolved: 'pending', not null.
      const [first, second] = await Promise.all([
        beginHubSpotDealNoteSend(pool, organizationId, {
          userId,
          agentCollaborationId: collaboration.id,
          leadId,
          body: "Checking in.",
          idempotencyKey: "concurrent-retry:send",
        }),
        beginHubSpotDealNoteSend(pool, organizationId, {
          userId,
          agentCollaborationId: collaboration.id,
          leadId,
          body: "Checking in.",
          idempotencyKey: "concurrent-retry:send",
        }),
      ]);

      expect(first.id).toBe(begun.id);
      expect(second.id).toBe(begun.id);

      const resolvedValues = [first.alreadyResolved, second.alreadyResolved];
      // Exactly one caller must be told it's safe to send (null); the other
      // must be told a send is already in flight (pending) — never both
      // null, which would mean two real HubSpot calls for one approval.
      expect(resolvedValues.filter((value) => value === null)).toHaveLength(1);
      expect(
        resolvedValues.filter((value) => value === "pending"),
      ).toHaveLength(1);
    });

    it("does not let one organization begin a send against another's collaboration/lead", async () => {
      const orgA = await seedFixture("cross-tenant-a");
      const orgB = await seedFixture("cross-tenant-b");

      await expect(
        beginHubSpotDealNoteSend(pool, orgA.organizationId, {
          userId: orgA.userId,
          agentCollaborationId: orgB.collaboration.id,
          leadId: orgB.leadId,
          body: "Checking in.",
          idempotencyKey: "cross-tenant-attempt",
        }),
      ).rejects.toThrow();
    });
  },
);
