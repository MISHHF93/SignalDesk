import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  appendInvestigationSteps,
  completeInvestigationStep,
  listInvestigationSteps,
  startInvestigationStep,
} from "../src/agent-investigation-steps";
import { startAgentCollaboration } from "../src/agent-collaborations";
import type { DatabasePool } from "../src/client";
import { getTestPool, seedMembership } from "./support";

async function startCollaboration(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  id?: string,
) {
  return startAgentCollaboration(pool, organizationId, {
    ...(id ? { id } : {}),
    userId,
    pattern: "parallel_specialists",
    objective: "Investigate current finance and delivery risk.",
    correlationId: randomUUID(),
    idempotencyKey: randomUUID(),
  });
}

describe.skipIf(!process.env.DATABASE_URL)(
  "agent investigation steps (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("starts a collaboration with a caller-supplied id", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const suppliedId = randomUUID();

      const collaboration = await startCollaboration(
        pool,
        organizationId,
        userId,
        suppliedId,
      );

      expect(collaboration.id).toBe(suppliedId);
    });

    it("declares a step plan all pending, in the given order", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await startCollaboration(
        pool,
        organizationId,
        userId,
      );

      const steps = await appendInvestigationSteps(
        pool,
        organizationId,
        collaboration.id,
        ["Checking overdue invoices…", "Reconciling findings…"],
      );

      expect(steps).toHaveLength(2);
      expect(steps[0]).toMatchObject({
        stepIndex: 0,
        label: "Checking overdue invoices…",
        status: "pending",
      });
      expect(steps[1]).toMatchObject({
        stepIndex: 1,
        label: "Reconciling findings…",
        status: "pending",
      });
      expect(steps[0]?.startedAt).toBeNull();
      expect(steps[0]?.completedAt).toBeNull();
    });

    it("returns an empty array without writing anything for an empty label list", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await startCollaboration(
        pool,
        organizationId,
        userId,
      );

      const steps = await appendInvestigationSteps(
        pool,
        organizationId,
        collaboration.id,
        [],
      );

      expect(steps).toEqual([]);
      expect(
        await listInvestigationSteps(pool, organizationId, collaboration.id),
      ).toEqual([]);
    });

    it("moves a step from pending to running to done, timestamping both transitions", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await startCollaboration(
        pool,
        organizationId,
        userId,
      );
      await appendInvestigationSteps(pool, organizationId, collaboration.id, [
        "Checking overdue invoices…",
      ]);

      await startInvestigationStep(pool, organizationId, collaboration.id, 0);
      const [running] = await listInvestigationSteps(
        pool,
        organizationId,
        collaboration.id,
      );

      expect(running?.status).toBe("running");
      expect(running?.startedAt).toBeInstanceOf(Date);
      expect(running?.completedAt).toBeNull();

      await completeInvestigationStep(
        pool,
        organizationId,
        collaboration.id,
        0,
        "done",
      );
      const [done] = await listInvestigationSteps(
        pool,
        organizationId,
        collaboration.id,
      );

      expect(done?.status).toBe("done");
      expect(done?.startedAt).toBeInstanceOf(Date);
      expect(done?.completedAt).toBeInstanceOf(Date);
    });

    it("can complete a step as failed", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await startCollaboration(
        pool,
        organizationId,
        userId,
      );
      await appendInvestigationSteps(pool, organizationId, collaboration.id, [
        "Checking stuck support tickets…",
      ]);

      await startInvestigationStep(pool, organizationId, collaboration.id, 0);
      await completeInvestigationStep(
        pool,
        organizationId,
        collaboration.id,
        0,
        "failed",
      );

      const [step] = await listInvestigationSteps(
        pool,
        organizationId,
        collaboration.id,
      );

      expect(step?.status).toBe("failed");
    });

    it("never rewinds a step that already finished (a stale/duplicate transition is a no-op)", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await startCollaboration(
        pool,
        organizationId,
        userId,
      );
      await appendInvestigationSteps(pool, organizationId, collaboration.id, [
        "Checking overdue invoices…",
      ]);
      await startInvestigationStep(pool, organizationId, collaboration.id, 0);
      await completeInvestigationStep(
        pool,
        organizationId,
        collaboration.id,
        0,
        "done",
      );

      // A duplicate/late "start" after the step already finished must not
      // reset it back to running.
      await startInvestigationStep(pool, organizationId, collaboration.id, 0);

      const [step] = await listInvestigationSteps(
        pool,
        organizationId,
        collaboration.id,
      );

      expect(step?.status).toBe("done");
    });

    it("orders steps by step_index regardless of completion order", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await startCollaboration(
        pool,
        organizationId,
        userId,
      );
      await appendInvestigationSteps(pool, organizationId, collaboration.id, [
        "Checking overdue invoices…",
        "Checking overdue tasks…",
        "Reconciling findings…",
      ]);

      // Complete out of order — the second step settles before the first.
      await startInvestigationStep(pool, organizationId, collaboration.id, 1);
      await completeInvestigationStep(
        pool,
        organizationId,
        collaboration.id,
        1,
        "done",
      );

      const steps = await listInvestigationSteps(
        pool,
        organizationId,
        collaboration.id,
      );

      expect(steps.map((step) => step.stepIndex)).toEqual([0, 1, 2]);
      expect(steps[1]?.status).toBe("done");
      expect(steps[0]?.status).toBe("pending");
      expect(steps[2]?.status).toBe("pending");
    });

    it("scopes step reads to the requesting organization", async () => {
      const seedA = await seedMembership(pool);
      const seedB = await seedMembership(pool);
      const collaboration = await startCollaboration(
        pool,
        seedA.organizationId,
        seedA.userId,
      );
      await appendInvestigationSteps(
        pool,
        seedA.organizationId,
        collaboration.id,
        ["Checking overdue invoices…"],
      );

      const crossTenantRead = await listInvestigationSteps(
        pool,
        seedB.organizationId,
        collaboration.id,
      );

      expect(crossTenantRead).toEqual([]);
    });
  },
);
