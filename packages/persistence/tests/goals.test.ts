import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { createGoal, listGoals } from "../src/goals";
import { getTestPool, seedMembership } from "./support";

describe.skipIf(!process.env.DATABASE_URL)("goals (live database)", () => {
  let pool: DatabasePool;

  beforeAll(() => {
    pool = getTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a real goal and its audit event", async () => {
    const { organizationId, userId } = await seedMembership(pool);

    const result = await createGoal(pool, organizationId, {
      userId,
      metricId: "accounts_receivable",
      name: "Keep AR under $50,000",
      comparisonOperator: "at_most",
      targetValue: 5_000_000,
      currency: "USD",
      idempotencyKey: `goal-${randomUUID()}`,
    });

    expect(result.created).toBe(true);
    expect(result.metricId).toBe("accounts_receivable");
    expect(result.targetValue).toBe(5_000_000);
    expect(typeof result.ownerMembershipId).toBe("string");
  });

  it("rejects an unknown metric id — the database check constraint enforces the real catalog", async () => {
    const { organizationId, userId } = await seedMembership(pool);

    await expect(
      createGoal(pool, organizationId, {
        userId,
        metricId: "not_a_real_metric",
        name: "Bogus goal",
        comparisonOperator: "at_most",
        targetValue: 1,
        currency: null,
        idempotencyKey: `goal-${randomUUID()}`,
      }),
    ).rejects.toThrow();
  });

  it("replays idempotently — the same key returns the original goal, not a duplicate", async () => {
    const { organizationId, userId } = await seedMembership(pool);
    const idempotencyKey = `goal-${randomUUID()}`;

    const first = await createGoal(pool, organizationId, {
      userId,
      metricId: "pipeline_value",
      name: "Grow pipeline past $1M",
      comparisonOperator: "at_least",
      targetValue: 100_000_000,
      currency: "USD",
      idempotencyKey,
    });
    const second = await createGoal(pool, organizationId, {
      userId,
      metricId: "pipeline_value",
      name: "Grow pipeline past $1M",
      comparisonOperator: "at_least",
      targetValue: 100_000_000,
      currency: "USD",
      idempotencyKey,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
  });

  it("lists an organization's own goals newest first", async () => {
    const { organizationId, userId } = await seedMembership(pool);

    const first = await createGoal(pool, organizationId, {
      userId,
      metricId: "open_task_backlog",
      name: "Backlog under 10",
      comparisonOperator: "at_most",
      targetValue: 10,
      currency: null,
      idempotencyKey: `goal-${randomUUID()}`,
    });
    const second = await createGoal(pool, organizationId, {
      userId,
      metricId: "cash_collected_recent",
      name: "Collect at least $10,000",
      comparisonOperator: "at_least",
      targetValue: 1_000_000,
      currency: "USD",
      idempotencyKey: `goal-${randomUUID()}`,
    });

    const list = await listGoals(pool, organizationId);
    const ids = list.map((goal) => goal.id);

    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });

  it("does not return another organization's goals", async () => {
    const orgA = await seedMembership(pool);
    const orgB = await seedMembership(pool);

    await createGoal(pool, orgB.organizationId, {
      userId: orgB.userId,
      metricId: "accounts_receivable",
      name: "Org B's goal",
      comparisonOperator: "at_most",
      targetValue: 1,
      currency: "USD",
      idempotencyKey: `goal-${randomUUID()}`,
    });

    const listFromOrgA = await listGoals(pool, orgA.organizationId);

    expect(listFromOrgA.some((goal) => goal.name === "Org B's goal")).toBe(
      false,
    );
  });
});
