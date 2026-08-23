import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { startAgentCollaboration } from "../src/agent-collaborations";
import {
  assertGrantActive,
  GrantExpiredError,
  listRecentAgentDelegationGrants,
  mintCapabilityGrant,
} from "../src/agent-delegation-grants";
import { getTestPool, seedMembership } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "agent delegation grants (live database)",
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

    it("mints a grant that expires roughly ttlMs from now", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await seedCollaboration(organizationId, userId);
      const before = Date.now();

      const grant = await mintCapabilityGrant(pool, organizationId, {
        collaborationId: collaboration.id,
        agentId: "claude-specialist",
        capability: "interpret_financial_risk",
        canPropose: true,
        ttlMs: 5 * 60 * 1_000,
      });

      const expectedExpiry = before + 5 * 60 * 1_000;
      expect(Math.abs(grant.expiresAt.getTime() - expectedExpiry)).toBeLessThan(
        5_000,
      );
      expect(grant.canPropose).toBe(true);
    });

    it("does not return another organization's grant", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);
      const collaboration = await seedCollaboration(
        orgB.organizationId,
        orgB.userId,
      );

      await expect(
        mintCapabilityGrant(pool, orgA.organizationId, {
          collaborationId: collaboration.id,
          agentId: "claude-specialist",
          capability: "interpret_financial_risk",
          canPropose: true,
          ttlMs: 60_000,
        }),
      ).rejects.toThrow();
    });

    it("lists real minted grants newest first", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const collaboration = await seedCollaboration(organizationId, userId);

      const first = await mintCapabilityGrant(pool, organizationId, {
        collaborationId: collaboration.id,
        agentId: "claude-specialist",
        capability: "interpret_financial_risk",
        canPropose: true,
        ttlMs: 60_000,
      });
      const second = await mintCapabilityGrant(pool, organizationId, {
        collaborationId: collaboration.id,
        agentId: "deterministic-specialist",
        capability: "interpret_delivery_risk",
        canPropose: false,
        ttlMs: 60_000,
      });

      const grants = await listRecentAgentDelegationGrants(
        pool,
        organizationId,
      );

      expect(grants.map((grant) => grant.id)).toEqual([second.id, first.id]);
      expect(grants[0]?.agentId).toBe("deterministic-specialist");
      expect(grants[0]?.canPropose).toBe(false);
      expect(grants[0]?.createdAt).toBeInstanceOf(Date);
    });

    it("does not list another organization's grants", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);
      const collaboration = await seedCollaboration(
        orgB.organizationId,
        orgB.userId,
      );

      await mintCapabilityGrant(pool, orgB.organizationId, {
        collaborationId: collaboration.id,
        agentId: "claude-specialist",
        capability: "interpret_financial_risk",
        canPropose: true,
        ttlMs: 60_000,
      });

      const grants = await listRecentAgentDelegationGrants(
        pool,
        orgA.organizationId,
      );

      expect(grants).toEqual([]);
    });
  },
);

describe("assertGrantActive", () => {
  const grant = {
    id: "grant-1",
    collaborationId: "collab-1",
    agentId: "claude-specialist",
    capability: "interpret_financial_risk",
    canPropose: true,
    expiresAt: new Date("2026-08-19T12:05:00.000Z"),
  };

  it("does not throw before expiry", () => {
    expect(() =>
      assertGrantActive(grant, new Date("2026-08-19T12:00:00.000Z")),
    ).not.toThrow();
  });

  it("throws GrantExpiredError at or after expiry", () => {
    expect(() =>
      assertGrantActive(grant, new Date("2026-08-19T12:05:00.000Z")),
    ).toThrow(GrantExpiredError);
    expect(() =>
      assertGrantActive(grant, new Date("2026-08-19T12:06:00.000Z")),
    ).toThrow(GrantExpiredError);
  });
});
