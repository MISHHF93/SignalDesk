import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  completeAgentCollaboration,
  getAgentCollaboration,
  listRecentAgentCollaborations,
  recordAgentCollaborationOutcome,
  resetAgentCollaborationOutcome,
  startAgentCollaboration,
} from "../src/agent-collaborations";
import {
  getTestPool,
  seedIntegration,
  seedMembership,
  seedMessage,
  seedSourceRecord,
} from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "agent collaborations (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("starts a collaboration in the running state", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const collaboration = await startAgentCollaboration(
        pool,
        organizationId,
        {
          userId,
          pattern: "parallel_specialists",
          objective: "Investigate current finance and delivery risk.",
          correlationId: "correlation-1",
          idempotencyKey: "agent-investigate:org-1:1",
        },
      );

      expect(collaboration.status).toBe("running");
      expect(collaboration.completedAt).toBeNull();
      expect(collaboration.reconciledSummary).toBeNull();
      expect(collaboration.outcome).toBeNull();
      expect(collaboration.reviewedAt).toBeNull();
    });

    it("rejects starting a collaboration for a user with no membership", async () => {
      await expect(
        startAgentCollaboration(pool, "11111111-1111-4111-8111-111111111111", {
          userId: "22222222-2222-4222-8222-222222222222",
          pattern: "parallel_specialists",
          objective: "Investigate.",
          correlationId: "correlation-2",
          idempotencyKey: "agent-investigate:org-2:1",
        }),
      ).rejects.toThrow();
    });

    it("completes a collaboration with its reconciled result", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const started = await startAgentCollaboration(pool, organizationId, {
        userId,
        pattern: "parallel_specialists",
        objective: "Investigate current finance and delivery risk.",
        correlationId: "correlation-3",
        idempotencyKey: "agent-investigate:org-3:1",
      });

      const completed = await completeAgentCollaboration(
        pool,
        organizationId,
        started.id,
        {
          status: "completed",
          reconciledSummary: "Two invoices and one task need attention.",
          reconciledConfidenceBasisPoints: 8_500,
          contradictionsDetected: false,
        },
      );

      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(completed.reconciledSummary).toBe(
        "Two invoices and one task need attention.",
      );
      expect(completed.reconciledConfidenceBasisPoints).toBe(8_500);

      const fetched = await getAgentCollaboration(
        pool,
        organizationId,
        started.id,
      );
      expect(fetched?.status).toBe("completed");
    });

    it("throws completing a collaboration that does not exist", async () => {
      const { organizationId } = await seedMembership(pool);

      await expect(
        completeAgentCollaboration(
          pool,
          organizationId,
          "33333333-3333-4333-8333-333333333333",
          {
            status: "failed",
            reconciledSummary: null,
            reconciledConfidenceBasisPoints: null,
            contradictionsDetected: false,
          },
        ),
      ).rejects.toThrow(/not found/i);
    });

    it("returns null for a collaboration that does not exist", async () => {
      const { organizationId } = await seedMembership(pool);

      const result = await getAgentCollaboration(
        pool,
        organizationId,
        "44444444-4444-4444-8444-444444444444",
      );

      expect(result).toBeNull();
    });

    it("does not return another organization's collaboration", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);

      const collaboration = await startAgentCollaboration(
        pool,
        orgB.organizationId,
        {
          userId: orgB.userId,
          pattern: "parallel_specialists",
          objective: "Org B's investigation.",
          correlationId: "correlation-4",
          idempotencyKey: "agent-investigate:org-b:1",
        },
      );

      const fromOrgA = await getAgentCollaboration(
        pool,
        orgA.organizationId,
        collaboration.id,
      );
      const listFromOrgA = await listRecentAgentCollaborations(
        pool,
        orgA.organizationId,
      );

      expect(fromOrgA).toBeNull();
      expect(listFromOrgA.some((row) => row.id === collaboration.id)).toBe(
        false,
      );
    });

    it("lists an organization's own collaborations newest first", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const first = await startAgentCollaboration(pool, organizationId, {
        userId,
        pattern: "parallel_specialists",
        objective: "First investigation.",
        correlationId: "correlation-5",
        idempotencyKey: "agent-investigate:org-5:1",
      });
      const second = await startAgentCollaboration(pool, organizationId, {
        userId,
        pattern: "parallel_specialists",
        objective: "Second investigation.",
        correlationId: "correlation-6",
        idempotencyKey: "agent-investigate:org-5:2",
      });

      const list = await listRecentAgentCollaborations(pool, organizationId);
      const ids = list.map((row) => row.id);

      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    });

    it("records an approved outcome, queryable back from the row", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const started = await startAgentCollaboration(pool, organizationId, {
        userId,
        pattern: "parallel_specialists",
        objective: "Investigate overdue invoices.",
        correlationId: "correlation-7",
        idempotencyKey: "agent-investigate:org-7:1",
      });

      const reviewed = await recordAgentCollaborationOutcome(
        pool,
        organizationId,
        started.id,
        "approved",
      );

      expect(reviewed?.outcome).toBe("approved");
      expect(reviewed?.reviewedAt).toBeInstanceOf(Date);

      const fetched = await getAgentCollaboration(
        pool,
        organizationId,
        started.id,
      );
      expect(fetched?.outcome).toBe("approved");
      expect(fetched?.reviewedAt).toBeInstanceOf(Date);
    });

    it("records a dismissed outcome", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const started = await startAgentCollaboration(pool, organizationId, {
        userId,
        pattern: "parallel_specialists",
        objective: "Investigate stuck leads.",
        correlationId: "correlation-8",
        idempotencyKey: "agent-investigate:org-8:1",
      });

      const reviewed = await recordAgentCollaborationOutcome(
        pool,
        organizationId,
        started.id,
        "dismissed",
      );

      expect(reviewed?.outcome).toBe("dismissed");
    });

    it("returns null recording an outcome for a collaboration that does not exist", async () => {
      const { organizationId } = await seedMembership(pool);

      const result = await recordAgentCollaborationOutcome(
        pool,
        organizationId,
        "55555555-5555-4555-8555-555555555555",
        "approved",
      );

      expect(result).toBeNull();
    });

    it("does not let one organization record an outcome on another's collaboration", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);

      const collaboration = await startAgentCollaboration(
        pool,
        orgB.organizationId,
        {
          userId: orgB.userId,
          pattern: "parallel_specialists",
          objective: "Org B's investigation.",
          correlationId: "correlation-9",
          idempotencyKey: "agent-investigate:org-b:2",
        },
      );

      const result = await recordAgentCollaborationOutcome(
        pool,
        orgA.organizationId,
        collaboration.id,
        "approved",
      );

      expect(result).toBeNull();

      const stillUnreviewed = await getAgentCollaboration(
        pool,
        orgB.organizationId,
        collaboration.id,
      );
      expect(stillUnreviewed?.outcome).toBeNull();
    });

    /**
     * The actual regression test for the trust-boundary fix: this is what
     * an unconditional `UPDATE ... set outcome = $3` (no `and outcome is
     * null` guard) could not prevent — a second decision silently
     * overwriting the first, letting the persisted outcome diverge from
     * what a caller (e.g. `approveAgentActionProposalAction`, which only
     * creates its task after a successful claim) actually did.
     */
    it("refuses a second decision once the first has already claimed the outcome", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const started = await startAgentCollaboration(pool, organizationId, {
        userId,
        pattern: "parallel_specialists",
        objective: "Investigate a stuck deal.",
        correlationId: "correlation-10",
        idempotencyKey: "agent-investigate:org-10:1",
      });

      const firstClaim = await recordAgentCollaborationOutcome(
        pool,
        organizationId,
        started.id,
        "approved",
      );
      // A racing dismiss from a second tab, after approve already won.
      const secondClaim = await recordAgentCollaborationOutcome(
        pool,
        organizationId,
        started.id,
        "dismissed",
      );

      expect(firstClaim?.outcome).toBe("approved");
      expect(secondClaim).toBeNull();

      const fetched = await getAgentCollaboration(
        pool,
        organizationId,
        started.id,
      );
      // The first decision stands; the second never overwrote it.
      expect(fetched?.outcome).toBe("approved");
    });

    it("resetAgentCollaborationOutcome clears a claim so it can be reviewed again", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const started = await startAgentCollaboration(pool, organizationId, {
        userId,
        pattern: "parallel_specialists",
        objective: "Investigate an overdue invoice.",
        correlationId: "correlation-11",
        idempotencyKey: "agent-investigate:org-11:1",
      });

      await recordAgentCollaborationOutcome(
        pool,
        organizationId,
        started.id,
        "approved",
      );
      await resetAgentCollaborationOutcome(pool, organizationId, started.id);

      const afterReset = await getAgentCollaboration(
        pool,
        organizationId,
        started.id,
      );
      expect(afterReset?.outcome).toBeNull();
      expect(afterReset?.reviewedAt).toBeNull();

      // The guard should accept a fresh claim again after the reset.
      const reclaimed = await recordAgentCollaborationOutcome(
        pool,
        organizationId,
        started.id,
        "dismissed",
      );
      expect(reclaimed?.outcome).toBe("dismissed");
    });

    describe("single_specialist pattern (ADR 0056 — message reply drafting)", () => {
      it("starts a single_specialist collaboration carrying a real messageId", async () => {
        const { organizationId, userId } = await seedMembership(pool);
        const integration = await seedIntegration(pool, organizationId);
        const sourceRecord = await seedSourceRecord(
          pool,
          organizationId,
          integration.id,
          integration.sourceSystem,
        );
        const message = await seedMessage(
          pool,
          organizationId,
          sourceRecord.id,
        );

        const collaboration = await startAgentCollaboration(
          pool,
          organizationId,
          {
            userId,
            pattern: "single_specialist",
            objective: "Draft a reply to this message.",
            correlationId: "correlation-single-1",
            idempotencyKey: "message-reply-draft:org-single-1:1",
            messageId: message.id,
          },
        );

        expect(collaboration.pattern).toBe("single_specialist");
        expect(collaboration.messageId).toBe(message.id);
        expect(collaboration.draftedContent).toBeNull();
      });

      it("rejects a single_specialist collaboration with no messageId", async () => {
        const { organizationId, userId } = await seedMembership(pool);

        await expect(
          startAgentCollaboration(pool, organizationId, {
            userId,
            pattern: "single_specialist",
            objective: "Draft a reply.",
            correlationId: "correlation-single-2",
            idempotencyKey: "message-reply-draft:org-single-2:1",
          }),
        ).rejects.toThrow();
      });

      it("rejects a parallel_specialists collaboration that carries a messageId", async () => {
        const { organizationId, userId } = await seedMembership(pool);
        const integration = await seedIntegration(pool, organizationId);
        const sourceRecord = await seedSourceRecord(
          pool,
          organizationId,
          integration.id,
          integration.sourceSystem,
        );
        const message = await seedMessage(
          pool,
          organizationId,
          sourceRecord.id,
        );

        await expect(
          startAgentCollaboration(pool, organizationId, {
            userId,
            pattern: "parallel_specialists",
            objective: "Investigate current risk.",
            correlationId: "correlation-single-3",
            idempotencyKey: "agent-investigate:org-single-3:1",
            messageId: message.id,
          }),
        ).rejects.toThrow();
      });

      it("completes a single_specialist collaboration with a real drafted reply, queryable back", async () => {
        const { organizationId, userId } = await seedMembership(pool);
        const integration = await seedIntegration(pool, organizationId);
        const sourceRecord = await seedSourceRecord(
          pool,
          organizationId,
          integration.id,
          integration.sourceSystem,
        );
        const message = await seedMessage(
          pool,
          organizationId,
          sourceRecord.id,
        );
        const started = await startAgentCollaboration(pool, organizationId, {
          userId,
          pattern: "single_specialist",
          objective: "Draft a reply to this message.",
          correlationId: "correlation-single-4",
          idempotencyKey: "message-reply-draft:org-single-4:1",
          messageId: message.id,
        });

        const completed = await completeAgentCollaboration(
          pool,
          organizationId,
          started.id,
          {
            status: "completed",
            reconciledSummary: null,
            reconciledConfidenceBasisPoints: null,
            contradictionsDetected: false,
            draftedContent: {
              subject: "Re: Question about my order",
              body: "Thanks for reaching out — your order ships tomorrow.",
            },
          },
        );

        expect(completed.draftedContent).toEqual({
          subject: "Re: Question about my order",
          body: "Thanks for reaching out — your order ships tomorrow.",
        });

        const fetched = await getAgentCollaboration(
          pool,
          organizationId,
          started.id,
        );
        expect(fetched?.draftedContent).toEqual({
          subject: "Re: Question about my order",
          body: "Thanks for reaching out — your order ships tomorrow.",
        });
      });

      it("regression: rejects completing a message-linked collaboration with a drafted body but no subject — a real gmail reply needs one", async () => {
        // Real gap found by review: agent_collaborations_drafted_content_
        // consistent was loosened from a strict Gmail-only equality check
        // to "subject implies body" alone, to accommodate the other four
        // entity types' body-only drafts (Asana/HubSpot/Zendesk comment or
        // note). That loosening applied uniformly, so a message_id-linked
        // collaboration used to be allowed to complete with a real body and
        // no subject at all — this is the constraint added back to close
        // that gap specifically for message_id-linked rows.
        const { organizationId, userId } = await seedMembership(pool);
        const integration = await seedIntegration(pool, organizationId);
        const sourceRecord = await seedSourceRecord(
          pool,
          organizationId,
          integration.id,
          integration.sourceSystem,
        );
        const message = await seedMessage(
          pool,
          organizationId,
          sourceRecord.id,
        );
        const started = await startAgentCollaboration(pool, organizationId, {
          userId,
          pattern: "single_specialist",
          objective: "Draft a reply to this message.",
          correlationId: "correlation-single-5",
          idempotencyKey: "message-reply-draft:org-single-5:1",
          messageId: message.id,
        });

        await expect(
          completeAgentCollaboration(pool, organizationId, started.id, {
            status: "completed",
            reconciledSummary: null,
            reconciledConfidenceBasisPoints: null,
            contradictionsDetected: false,
            draftedContent: {
              body: "Thanks for reaching out — your order ships tomorrow.",
            },
          }),
        ).rejects.toThrow();
      });
    });
  },
);
