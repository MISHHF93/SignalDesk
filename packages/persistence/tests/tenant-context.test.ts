import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedOrganization } from "./support";

// Exercises withTenantContext's own transactional guarantee against the
// live database — this repo's Phase 4 adversarial certification pass
// (SIGNALDESK_SYSTEM_CERTIFICATION.md) named "transactional integrity
// under interruption" as a real scenario it couldn't live-test without
// code instrumentation. This file is that instrumentation: every real
// Safe Action and persistence write in this app goes through
// withTenantContext, so its rollback-on-error behavior is the one
// guarantee everything else quietly depends on, yet nothing directly
// proved it against a real Postgres transaction before this file existed.
describe.skipIf(!process.env.DATABASE_URL)(
  "withTenantContext transactional integrity (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("commits a real write when the callback succeeds", async () => {
      const org = await seedOrganization(pool);
      const taskId = randomUUID();

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          `insert into internal_tasks (id, organization_id, title, idempotency_key)
           values ($1, $2, 'Commit sanity check', $3)`,
          [taskId, org.id, `tenant-context-test:commit:${randomUUID()}`],
        );
      });

      const result = await withTenantContext(pool, org.id, async (client) => {
        const r = await client.query(
          "select id from internal_tasks where id = $1",
          [taskId],
        );
        return r.rows[0];
      });

      expect(result?.id).toBe(taskId);
    });

    it("rolls back a real insert when the callback throws after it", async () => {
      const org = await seedOrganization(pool);
      const taskId = randomUUID();

      await expect(
        withTenantContext(pool, org.id, async (client) => {
          await client.query(
            `insert into internal_tasks (id, organization_id, title, idempotency_key)
             values ($1, $2, 'Should never persist', $3)`,
            [taskId, org.id, `tenant-context-test:rollback:${randomUUID()}`],
          );

          throw new Error("deliberate mid-transaction failure");
        }),
      ).rejects.toThrow("deliberate mid-transaction failure");

      const result = await withTenantContext(pool, org.id, async (client) => {
        const r = await client.query(
          "select id from internal_tasks where id = $1",
          [taskId],
        );
        return r.rows[0];
      });

      expect(result).toBeUndefined();
    });

    it("rolls back an earlier successful statement when a later one in the same transaction fails", async () => {
      const org = await seedOrganization(pool);
      const firstTaskId = randomUUID();
      const sharedIdempotencyKey = `tenant-context-test:partial-write:${randomUUID()}`;

      await expect(
        withTenantContext(pool, org.id, async (client) => {
          await client.query(
            `insert into internal_tasks (id, organization_id, title, idempotency_key)
             values ($1, $2, 'First statement, should not survive', $3)`,
            [firstTaskId, org.id, sharedIdempotencyKey],
          );

          // A real Postgres unique-violation (internal_tasks_org_idempotency_unique),
          // not a thrown JS error — proves the rollback holds for a genuine
          // database-level failure, not just an application-level throw.
          await client.query(
            `insert into internal_tasks (id, organization_id, title, idempotency_key)
             values ($1, $2, 'Second statement, forces the real conflict', $3)`,
            [randomUUID(), org.id, sharedIdempotencyKey],
          );
        }),
      ).rejects.toThrow();

      const result = await withTenantContext(pool, org.id, async (client) => {
        const r = await client.query(
          "select id from internal_tasks where organization_id = $1",
          [org.id],
        );
        return r.rows;
      });

      expect(result).toHaveLength(0);
    });

    it("rejects an invalid organizationId before ever opening a transaction", async () => {
      await expect(
        withTenantContext(pool, "not-a-uuid", async () => {
          throw new Error("should never be called");
        }),
      ).rejects.toThrow(/must be a UUID/i);
    });
  },
);
