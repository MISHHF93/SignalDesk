import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  getInternalCostSummary,
  recordInternalCostEvent,
} from "../src/internal-cost-events";
import { getTestPool, seedOrganization } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "internal cost events (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("records a real cost event with an honestly-null cost when no pricing is known", async () => {
      const org = await seedOrganization(pool);

      const event = await recordInternalCostEvent(pool, org.id, {
        eventType: "claude_specialist_invocation",
        metadata: { agentId: "claude-specialist", capability: "financial" },
      });

      expect(event.eventType).toBe("claude_specialist_invocation");
      expect(event.quantity).toBe(1);
      expect(event.estimatedCostCents).toBeNull();
      expect(event.metadata).toEqual({
        agentId: "claude-specialist",
        capability: "financial",
      });
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it("records a real event with a caller-supplied quantity and cost", async () => {
      const org = await seedOrganization(pool);

      const event = await recordInternalCostEvent(pool, org.id, {
        eventType: "claude_specialist_invocation",
        quantity: 3,
        estimatedCostCents: 12,
      });

      expect(event.quantity).toBe(3);
      expect(event.estimatedCostCents).toBe(12);
    });

    it("rejects a blank event type — the database check constraint enforces it", async () => {
      const org = await seedOrganization(pool);

      await expect(
        recordInternalCostEvent(pool, org.id, { eventType: "   " }),
      ).rejects.toThrow();
    });

    it("cannot see another organization's cost events", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);

      await recordInternalCostEvent(pool, orgB.id, {
        eventType: "claude_specialist_invocation",
      });

      const summary = await getInternalCostSummary(pool, orgA.id, new Date(0));

      expect(summary).toEqual([]);
    });

    it("aggregates real events by event type since a given date", async () => {
      const org = await seedOrganization(pool);

      await recordInternalCostEvent(pool, org.id, {
        eventType: "claude_specialist_invocation",
        estimatedCostCents: 10,
      });
      await recordInternalCostEvent(pool, org.id, {
        eventType: "claude_specialist_invocation",
        estimatedCostCents: 20,
      });
      await recordInternalCostEvent(pool, org.id, {
        eventType: "quickbooks_sync_run",
        estimatedCostCents: null,
      });

      const summary = await getInternalCostSummary(pool, org.id, new Date(0));

      expect(summary).toHaveLength(2);
      const claudeSummary = summary.find(
        (row) => row.eventType === "claude_specialist_invocation",
      );
      expect(claudeSummary).toMatchObject({
        totalQuantity: 2,
        totalEstimatedCostCents: 30,
        eventCount: 2,
      });
    });

    it("excludes events before the given date", async () => {
      const org = await seedOrganization(pool);

      await recordInternalCostEvent(pool, org.id, {
        eventType: "claude_specialist_invocation",
      });

      const future = new Date(Date.now() + 60_000);
      const summary = await getInternalCostSummary(pool, org.id, future);

      expect(summary).toEqual([]);
    });
  },
);
