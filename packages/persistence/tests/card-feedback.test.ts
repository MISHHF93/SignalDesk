import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  listRecentCardFeedback,
  recordCardFeedback,
} from "../src/card-feedback";
import { getTestPool, seedMembership } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "card feedback (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("records a real feedback event", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const record = await recordCardFeedback(pool, organizationId, {
        userId,
        findingId: "overdue-invoice:org-1:inv-1",
        cardType: "invoice_risk",
        feedback: "useful",
      });

      expect(record.findingId).toBe("overdue-invoice:org-1:inv-1");
      expect(record.cardType).toBe("invoice_risk");
      expect(record.feedback).toBe("useful");
      expect(record.createdAt).toBeInstanceOf(Date);
    });

    it("rejects feedback for a user with no membership", async () => {
      await expect(
        recordCardFeedback(pool, "11111111-1111-4111-8111-111111111111", {
          userId: "22222222-2222-4222-8222-222222222222",
          findingId: "stuck:org:lead-1",
          cardType: "stuck",
          feedback: "not_relevant",
        }),
      ).rejects.toThrow();
    });

    it("allows a second, different feedback event on the same finding — history, not an update", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const findingId = "stuck:org-1:lead-42";

      await recordCardFeedback(pool, organizationId, {
        userId,
        findingId,
        cardType: "stuck",
        feedback: "useful",
      });
      await recordCardFeedback(pool, organizationId, {
        userId,
        findingId,
        cardType: "stuck",
        feedback: "not_relevant",
      });

      const list = await listRecentCardFeedback(pool, organizationId);
      const forFinding = list.filter((row) => row.findingId === findingId);

      expect(forFinding).toHaveLength(2);
      expect(forFinding.map((row) => row.feedback)).toEqual(
        expect.arrayContaining(["useful", "not_relevant"]),
      );
    });

    it("lists an organization's own feedback newest first", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const first = await recordCardFeedback(pool, organizationId, {
        userId,
        findingId: "stuck:org-1:lead-1",
        cardType: "stuck",
        feedback: "useful",
      });
      const second = await recordCardFeedback(pool, organizationId, {
        userId,
        findingId: "stuck:org-1:lead-2",
        cardType: "stuck",
        feedback: "useful",
      });

      const list = await listRecentCardFeedback(pool, organizationId);
      const ids = list.map((row) => row.id);

      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    });

    it.each(["ownership_gap", "message_follow_up", "ticket_risk"] as const)(
      "accepts %s — added to the DB constraint in migration 0055 to match cardTypeSchema",
      async (cardType) => {
        const { organizationId, userId } = await seedMembership(pool);

        const record = await recordCardFeedback(pool, organizationId, {
          userId,
          findingId: `${cardType}:org-1:entity-1`,
          cardType,
          feedback: "useful",
        });

        expect(record.cardType).toBe(cardType);
      },
    );

    it("does not return another organization's feedback", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);

      await recordCardFeedback(pool, orgB.organizationId, {
        userId: orgB.userId,
        findingId: "stuck:org-b:lead-1",
        cardType: "stuck",
        feedback: "not_relevant",
      });

      const listFromOrgA = await listRecentCardFeedback(
        pool,
        orgA.organizationId,
      );

      expect(
        listFromOrgA.some((row) => row.findingId === "stuck:org-b:lead-1"),
      ).toBe(false);
    });
  },
);
