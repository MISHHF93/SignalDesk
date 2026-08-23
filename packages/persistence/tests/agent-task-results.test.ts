import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { startAgentCollaboration } from "../src/agent-collaborations";
import {
  insertAgentTaskResult,
  listAgentTaskResultsForCollaborations,
} from "../src/agent-task-results";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedMembership } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "agent task results (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    async function seedCollaboration(organizationId: string, userId: string) {
      return startAgentCollaboration(pool, organizationId, {
        userId,
        pattern: "parallel_specialists",
        objective: "Investigate current finance and delivery risk.",
        correlationId: `correlation-${Math.random()}`,
        idempotencyKey: `agent-investigate:${organizationId}:${Math.random()}`,
      });
    }

    it("inserts a task result with real jsonb claims and evidence ids", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await seedCollaboration(organizationId, userId);

      const startedAt = new Date("2026-08-19T12:00:00.000Z");
      const completedAt = new Date("2026-08-19T12:00:02.000Z");

      const result = await insertAgentTaskResult(pool, organizationId, {
        collaborationId: collaboration.id,
        agentId: "claude-specialist",
        capability: "interpret_financial_risk",
        status: "completed",
        claims: ["3 invoices totaling $4,200 are overdue."],
        evidenceIds: ["overdue-invoice:org-1:invoice-1"],
        confidenceBasisPoints: 8_000,
        startedAt,
        completedAt,
      });

      expect(result.agentId).toBe("claude-specialist");
      expect(result.claims).toEqual([
        "3 invoices totaling $4,200 are overdue.",
      ]);
      expect(result.evidenceIds).toEqual(["overdue-invoice:org-1:invoice-1"]);
      expect(result.startedAt).toEqual(startedAt);
      expect(result.completedAt).toEqual(completedAt);
    });

    it("lists results for one collaboration in call order", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await seedCollaboration(organizationId, userId);

      await insertAgentTaskResult(pool, organizationId, {
        collaborationId: collaboration.id,
        agentId: "claude-specialist",
        capability: "interpret_financial_risk",
        status: "completed",
        claims: [],
        evidenceIds: [],
        confidenceBasisPoints: 8_000,
        startedAt: new Date("2026-08-19T12:00:00.000Z"),
        completedAt: new Date("2026-08-19T12:00:01.000Z"),
      });
      await insertAgentTaskResult(pool, organizationId, {
        collaborationId: collaboration.id,
        agentId: "deterministic-specialist",
        capability: "interpret_delivery_risk",
        status: "completed",
        claims: [],
        evidenceIds: [],
        confidenceBasisPoints: 9_000,
        startedAt: new Date("2026-08-19T12:00:00.500Z"),
        completedAt: new Date("2026-08-19T12:00:01.200Z"),
      });

      const results = await listAgentTaskResultsForCollaborations(
        pool,
        organizationId,
        [collaboration.id],
      );

      expect(results.map((row) => row.agentId)).toEqual([
        "claude-specialist",
        "deterministic-specialist",
      ]);
    });

    it("batches results across multiple collaborations in one call — the real N+1 fix", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaborationA = await seedCollaboration(organizationId, userId);
      const collaborationB = await seedCollaboration(organizationId, userId);

      await insertAgentTaskResult(pool, organizationId, {
        collaborationId: collaborationA.id,
        agentId: "claude-specialist",
        capability: "interpret_financial_risk",
        status: "completed",
        claims: [],
        evidenceIds: [],
        confidenceBasisPoints: 8_000,
        startedAt: new Date("2026-08-19T12:00:00.000Z"),
        completedAt: new Date("2026-08-19T12:00:01.000Z"),
      });
      await insertAgentTaskResult(pool, organizationId, {
        collaborationId: collaborationB.id,
        agentId: "deterministic-specialist",
        capability: "interpret_delivery_risk",
        status: "completed",
        claims: [],
        evidenceIds: [],
        confidenceBasisPoints: 9_000,
        startedAt: new Date("2026-08-19T12:00:00.000Z"),
        completedAt: new Date("2026-08-19T12:00:01.000Z"),
      });

      const results = await listAgentTaskResultsForCollaborations(
        pool,
        organizationId,
        [collaborationA.id, collaborationB.id],
      );

      expect(results).toHaveLength(2);
      expect(
        results.find((row) => row.collaborationId === collaborationA.id)
          ?.agentId,
      ).toBe("claude-specialist");
      expect(
        results.find((row) => row.collaborationId === collaborationB.id)
          ?.agentId,
      ).toBe("deterministic-specialist");
    });

    it("returns an empty list without querying when given no collaboration ids", async () => {
      const { organizationId } = await seedMembership(pool);

      const results = await listAgentTaskResultsForCollaborations(
        pool,
        organizationId,
        [],
      );

      expect(results).toEqual([]);
    });

    it("throws a clear validation error for a malformed claims column, rather than returning a wrong value", async () => {
      // agent_task_results is append-only (no UPDATE grant for
      // app_runtime, confirmed by this same test attempting one and
      // getting a real permission error) — so the only way to exercise
      // this real validation path is a raw INSERT with malformed jsonb,
      // simulating the one way bad data could ever land here: a future
      // write-path bug bypassing insertAgentTaskResult's own real string[]
      // typing, not a route this app's normal code can take today.
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await seedCollaboration(organizationId, userId);

      await withTenantContext(pool, organizationId, async (client) => {
        await client.query(
          `insert into agent_task_results (
             id, organization_id, collaboration_id, agent_id, capability,
             status, claims, evidence_ids, confidence_basis_points,
             started_at, completed_at
           ) values (
             gen_random_uuid(), $1, $2, 'claude-specialist',
             'interpret_financial_risk', 'completed', '"not an array"'::jsonb,
             '[]'::jsonb, 8000, now(), now()
           )`,
          [organizationId, collaboration.id],
        );
      });

      await expect(
        listAgentTaskResultsForCollaborations(pool, organizationId, [
          collaboration.id,
        ]),
      ).rejects.toThrow(/claims is not a string array/);
    });

    it("records a failed specialist call without losing the row", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await seedCollaboration(organizationId, userId);

      const result = await insertAgentTaskResult(pool, organizationId, {
        collaborationId: collaboration.id,
        agentId: "claude-specialist",
        capability: "interpret_financial_risk",
        status: "failed",
        claims: [],
        evidenceIds: [],
        confidenceBasisPoints: null,
        startedAt: new Date("2026-08-19T12:00:00.000Z"),
        completedAt: new Date("2026-08-19T12:00:00.500Z"),
      });

      expect(result.status).toBe("failed");
      expect(result.confidenceBasisPoints).toBeNull();
    });

    it("does not return another organization's task results", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);
      const collaboration = await seedCollaboration(
        orgB.organizationId,
        orgB.userId,
      );

      await insertAgentTaskResult(pool, orgB.organizationId, {
        collaborationId: collaboration.id,
        agentId: "claude-specialist",
        capability: "interpret_financial_risk",
        status: "completed",
        claims: [],
        evidenceIds: [],
        confidenceBasisPoints: 8_000,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      const results = await listAgentTaskResultsForCollaborations(
        pool,
        orgA.organizationId,
        [collaboration.id],
      );

      expect(results).toEqual([]);
    });
  },
);
