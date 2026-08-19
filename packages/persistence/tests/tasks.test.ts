import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { ingestAsanaTask } from "../src/tasks";
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

// Exercises ingestAsanaTask against the live database: a real
// source_records → tasks write, idempotency on repeat ingestion of the
// same source_version, and tenant isolation.
describe.skipIf(!process.env.DATABASE_URL)(
  "asana task sync (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("writes a real source_record and a matching task", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      const input = fixtureInput();

      const result = await ingestAsanaTask(pool, org.id, integration.id, input);

      expect(result.inserted).toBe(true);
      expect(result.sourceRecordId).not.toBeNull();
      expect(result.taskId).not.toBeNull();

      const [sourceRecordRow, taskRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const sourceRecordResult = await client.query(
            "select source_system, source_object_type, external_record_id from source_records where id = $1",
            [result.sourceRecordId],
          );
          const taskResult = await client.query(
            "select name, assignee_name, completed from tasks where id = $1",
            [result.taskId],
          );
          return [sourceRecordResult.rows[0], taskResult.rows[0]];
        },
      );

      expect(sourceRecordRow).toEqual({
        source_system: "asana",
        source_object_type: "task",
        external_record_id: input.externalRecordId,
      });
      expect(taskRow).toEqual({
        name: input.name,
        assignee_name: input.assigneeName,
        completed: input.completed,
      });
    });

    it("is idempotent for the same external record at the same source version", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      const input = fixtureInput();

      const first = await ingestAsanaTask(pool, org.id, integration.id, input);
      const second = await ingestAsanaTask(pool, org.id, integration.id, input);

      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(false);
      expect(second.sourceRecordId).toBeNull();
    });

    it("cannot see another organization's ingested tasks", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationA = await seedIntegration(pool, orgA.id, {
        sourceSystem: "asana",
      });

      const result = await ingestAsanaTask(
        pool,
        orgA.id,
        integrationA.id,
        fixtureInput(),
      );

      const rows = await withTenantContext(pool, orgB.id, async (client) => {
        const taskResult = await client.query(
          "select id from tasks where id = $1",
          [result.taskId],
        );
        return taskResult.rows;
      });

      expect(rows).toHaveLength(0);
    });
  },
);
