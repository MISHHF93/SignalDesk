import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { listRecentAuditEvents, recordAuditEvent } from "../src/audit-events";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedMembership, seedOrganization } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "recordAuditEvent (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("writes a real, correctly attributed audit event", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      await recordAuditEvent(pool, organizationId, {
        userId,
        eventType: "integration.connected",
        subjectType: "integration",
        subjectId: "11111111-1111-4111-8111-111111111111",
        outcome: "succeeded",
        metadata: { sourceSystem: "hubspot" },
      });

      const row = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select event_type, subject_type, subject_id, outcome, actor_kind, actor_membership_id, metadata from audit_events where subject_id = $1",
            ["11111111-1111-4111-8111-111111111111"],
          );
          return result.rows[0];
        },
      );

      expect(row.event_type).toBe("integration.connected");
      expect(row.outcome).toBe("succeeded");
      expect(row.actor_kind).toBe("user");
      expect(row.actor_membership_id).not.toBeNull();
      expect(row.metadata).toEqual({ sourceSystem: "hubspot" });
    });

    it("allows two distinct events for the same subject without colliding", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const subjectId = "22222222-2222-4222-8222-222222222222";

      await recordAuditEvent(pool, organizationId, {
        userId,
        eventType: "integration.connected",
        subjectType: "integration",
        subjectId,
        outcome: "succeeded",
        metadata: {},
      });
      await recordAuditEvent(pool, organizationId, {
        userId,
        eventType: "integration.disconnected",
        subjectType: "integration",
        subjectId,
        outcome: "succeeded",
        metadata: {},
      });

      const rows = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select event_type from audit_events where subject_id = $1 order by occurred_at",
            [subjectId],
          );
          return result.rows;
        },
      );

      expect(rows.map((row) => row.event_type)).toEqual([
        "integration.connected",
        "integration.disconnected",
      ]);
    });

    it("rejects writing an event for a user with no membership in the organization", async () => {
      const org = await seedOrganization(pool);

      await expect(
        recordAuditEvent(pool, org.id, {
          userId: "33333333-3333-4333-8333-333333333333",
          eventType: "integration.connected",
          subjectType: "integration",
          subjectId: "44444444-4444-4444-8444-444444444444",
          outcome: "succeeded",
          metadata: {},
        }),
      ).rejects.toThrow(/no membership found/i);
    });

    it("writes an agent-attributed audit event with no membership involved", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      await recordAuditEvent(pool, organizationId, {
        userId,
        actorKind: "agent",
        actorAgentId: "claude-specialist",
        eventType: "agent.task.completed",
        subjectType: "agent_task_result",
        subjectId: "77777777-7777-4777-8777-777777777777",
        outcome: "succeeded",
        metadata: {},
      });

      const row = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select actor_kind, actor_agent_id, actor_membership_id from audit_events where subject_id = $1",
            ["77777777-7777-4777-8777-777777777777"],
          );
          return result.rows[0];
        },
      );

      expect(row.actor_kind).toBe("agent");
      expect(row.actor_agent_id).toBe("claude-specialist");
      expect(row.actor_membership_id).toBeNull();
    });

    it("rejects actorKind: agent with no actorAgentId", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      await expect(
        recordAuditEvent(pool, organizationId, {
          userId,
          actorKind: "agent",
          eventType: "agent.task.completed",
          subjectType: "agent_task_result",
          subjectId: "88888888-8888-4888-8888-888888888888",
          outcome: "succeeded",
          metadata: {},
        }),
      ).rejects.toThrow(/actorAgentId is required/i);
    });
  },
);

describe.skipIf(!process.env.DATABASE_URL)(
  "listRecentAuditEvents (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("returns an empty list for an organization with no audit history", async () => {
      const { organizationId } = await seedMembership(pool);

      const events = await listRecentAuditEvents(pool, organizationId);

      expect(events).toEqual([]);
    });

    it("returns real events newest first, without exposing metadata", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      await recordAuditEvent(pool, organizationId, {
        userId,
        eventType: "integration.connected",
        subjectType: "integration",
        subjectId: "55555555-5555-4555-8555-555555555555",
        outcome: "succeeded",
        metadata: { sourceSystem: "hubspot", secret: "should-not-leak" },
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recordAuditEvent(pool, organizationId, {
        userId,
        eventType: "integration.disconnected",
        subjectType: "integration",
        subjectId: "55555555-5555-4555-8555-555555555555",
        outcome: "succeeded",
        metadata: {},
      });

      const events = await listRecentAuditEvents(pool, organizationId);

      expect(events.map((event) => event.eventType)).toEqual([
        "integration.disconnected",
        "integration.connected",
      ]);
      expect(events[0]).not.toHaveProperty("metadata");
      expect(events[0]?.subjectType).toBe("integration");
      expect(events[0]?.outcome).toBe("succeeded");
      expect(events[0]?.occurredAt).toBeInstanceOf(Date);
    });

    it("does not return another organization's audit events", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);

      await recordAuditEvent(pool, orgB.organizationId, {
        userId: orgB.userId,
        eventType: "integration.connected",
        subjectType: "integration",
        subjectId: "66666666-6666-4666-8666-666666666666",
        outcome: "succeeded",
        metadata: {},
      });

      const events = await listRecentAuditEvents(pool, orgA.organizationId);

      expect(events).toEqual([]);
    });
  },
);
