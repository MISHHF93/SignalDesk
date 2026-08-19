import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { createInternalTask } from "../src/internal-tasks";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedMembership, seedOrganization } from "./support";

// Exercises createInternalTask end to end (real INSERT + real audit event)
// and the internal_tasks RLS/immutability policies added in
// drizzle/0006_woozy_swarm.sql, as the app_runtime role.
describe.skipIf(!process.env.DATABASE_URL)(
  "internal tasks (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a verified task and a matching, correctly attributed audit event", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const task = await createInternalTask(pool, organizationId, userId, {
        title: "Follow up with Priya",
        sourceCardId: "stuck:org-1:lead-1",
        idempotencyKey: "card-action:lead-1:follow-up",
      });

      expect(task.title).toBe("Follow up with Priya");
      expect(task.status).toBe("open");
      expect(task.created).toBe(true);

      const [taskRow, auditRow, membershipId] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const taskResult = await client.query(
            "select title, status, source_card_id, idempotency_key from internal_tasks where id = $1",
            [task.id],
          );
          const auditResult = await client.query(
            "select event_type, subject_id, outcome, actor_kind, actor_membership_id from audit_events where subject_id = $1",
            [task.id],
          );
          const membershipResult = await client.query(
            "select id from memberships where organization_id = $1 and user_id = $2",
            [organizationId, userId],
          );
          return [
            taskResult.rows[0],
            auditResult.rows[0],
            membershipResult.rows[0]?.id,
          ];
        },
      );

      expect(taskRow).toEqual({
        title: "Follow up with Priya",
        status: "open",
        source_card_id: "stuck:org-1:lead-1",
        idempotency_key: "card-action:lead-1:follow-up",
      });
      expect(auditRow).toEqual({
        event_type: "internal_task.created",
        subject_id: task.id,
        outcome: "succeeded",
        actor_kind: "user",
        actor_membership_id: membershipId,
      });
    });

    it("returns the original task instead of duplicating on a retried idempotency key", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const input = {
        title: "Follow up with Priya",
        idempotencyKey: "card-action:lead-1:follow-up",
      };

      const first = await createInternalTask(
        pool,
        organizationId,
        userId,
        input,
      );
      const second = await createInternalTask(
        pool,
        organizationId,
        userId,
        input,
      );

      expect(second.id).toBe(first.id);
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);

      const rows = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select id from internal_tasks where organization_id = $1 and idempotency_key = $2",
            [organizationId, input.idempotencyKey],
          );
          return result.rows;
        },
      );

      expect(rows).toHaveLength(1);
    });

    it("cannot see another organization's tasks", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedMembership(pool);

      await createInternalTask(pool, orgB.organizationId, orgB.userId, {
        title: "Org B's task",
        idempotencyKey: "card-action:org-b:task",
      });

      const rows = await withTenantContext(pool, orgA.id, async (client) => {
        const result = await client.query(
          "select id from internal_tasks where organization_id = $1",
          [orgB.organizationId],
        );
        return result.rows;
      });

      expect(rows).toHaveLength(0);
    });

    it("rejects changing an immutable column (organization_id) but allows status transitions", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const task = await createInternalTask(pool, organizationId, userId, {
        title: "Immutability check",
        idempotencyKey: "card-action:lead-2:immutability",
      });
      const otherOrgId = (await seedOrganization(pool)).id;

      await expect(
        withTenantContext(pool, organizationId, async (client) => {
          await client.query(
            "update internal_tasks set organization_id = $1 where id = $2",
            [otherOrgId, task.id],
          );
        }),
      ).rejects.toThrow(/immutable column/i);

      await withTenantContext(pool, organizationId, async (client) => {
        await client.query(
          "update internal_tasks set status = 'completed' where id = $1",
          [task.id],
        );
      });

      const status = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select status from internal_tasks where id = $1",
            [task.id],
          );
          return result.rows[0]?.status;
        },
      );

      expect(status).toBe("completed");
    });
  },
);
