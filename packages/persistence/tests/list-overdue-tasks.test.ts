import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { ingestAsanaTask, listOverdueTasks } from "../src/tasks";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

function fixtureInput(
  overrides: Partial<Parameters<typeof ingestAsanaTask>[3]> = {},
) {
  return {
    externalRecordId: `task-${randomUUID()}`,
    sourceVersion: "2026-08-17T11:55:00.000Z",
    rawPayloadSha256: "a".repeat(64),
    rawPayloadByteLength: 512,
    observedAt: new Date(),
    name: "Ship Q3 report",
    assigneeName: "Jordan Lee",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
    completed: false,
    ...overrides,
  };
}

// Exercises listOverdueTasks against the live database — the join across
// tasks/source_records/integrations, the "incomplete and past due" filter,
// ordering, and the active-integration-only filter.
describe.skipIf(!process.env.DATABASE_URL)(
  "listOverdueTasks (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("returns an empty list for an organization with no tasks yet", async () => {
      const org = await seedOrganization(pool);

      const tasks = await listOverdueTasks(pool, org.id);

      expect(tasks).toEqual([]);
    });

    it("does not surface a task that isn't due yet", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        fixtureInput({ dueAt: farFuture }),
      );

      const tasks = await listOverdueTasks(pool, org.id);

      expect(tasks).toEqual([]);
    });

    it("does not surface a completed task even past its due date", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });

      await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        fixtureInput({
          dueAt: new Date(Date.now() - 1000),
          completed: true,
        }),
      );

      const tasks = await listOverdueTasks(pool, org.id);

      expect(tasks).toEqual([]);
    });

    it("reads back a real overdue task with correct source provenance", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      const pastDue = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const input = fixtureInput({ dueAt: pastDue });

      const ingestResult = await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        input,
      );

      const tasks = await listOverdueTasks(pool, org.id);

      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task?.id).toBe(ingestResult.taskId);
      expect(task?.name).toBe(input.name);
      expect(task?.assigneeName).toBe(input.assigneeName);
      expect(task?.completed).toBe(false);
      expect(task?.source.system).toBe("asana");
      expect(task?.source.integrationId).toBe(integration.id);
      expect(task?.source.externalRecordId).toBe(input.externalRecordId);
    });

    it("orders overdue tasks oldest-due-first", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });

      const recentlyOverdue = await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        fixtureInput({
          dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        }),
      );
      const longOverdue = await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        fixtureInput({
          dueAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        }),
      );

      const tasks = await listOverdueTasks(pool, org.id);

      expect(tasks.map((task) => task.id)).toEqual([
        longOverdue.taskId,
        recentlyOverdue.taskId,
      ]);
    });

    it("cannot see another organization's overdue tasks", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await seedIntegration(pool, orgB.id, {
        sourceSystem: "asana",
      });

      await ingestAsanaTask(
        pool,
        orgB.id,
        integrationB.id,
        fixtureInput({ dueAt: new Date(Date.now() - 1000) }),
      );

      const tasks = await listOverdueTasks(pool, orgA.id);

      expect(tasks).toEqual([]);
    });

    it("stops surfacing a task once its source integration is disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        fixtureInput({ dueAt: new Date(Date.now() - 1000) }),
      );

      expect(await listOverdueTasks(pool, org.id)).toHaveLength(1);

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [integration.id],
        );
      });

      const tasks = await listOverdueTasks(pool, org.id);

      expect(tasks).toEqual([]);
    });
  },
);
