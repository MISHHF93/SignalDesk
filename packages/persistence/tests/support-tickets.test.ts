import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  getSupportTicketById,
  listStuckSupportTickets,
} from "../src/support-tickets";
import { withTenantContext } from "../src/tenant-context";
import { ingestZendeskTicket } from "../src/zendesk-sync";
import {
  getTestPool,
  seedIntegration,
  seedOrganization,
  seedSyncJob,
} from "./support";

function fixtureInput(
  syncJobId: string,
  overrides: Partial<Parameters<typeof ingestZendeskTicket>[3]> = {},
) {
  return {
    externalRecordId: `ticket-${randomUUID()}`,
    sourceVersion: "2026-08-18T13:56:00.000Z",
    rawPayloadSha256: "a".repeat(64),
    rawPayloadByteLength: 512,
    observedAt: new Date(),
    subject: "Cannot log in",
    status: "open",
    priority: "high",
    requesterName: "Jane Client",
    assigneeName: "Jamie Rivera",
    dueAt: null,
    lastActivityAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    syncJobId,
    ...overrides,
  };
}

// Exercises listStuckSupportTickets against the live database — the join
// across support_tickets/source_records/integrations/memberships, the
// `new`/`open`/`pending`-only status filter, ordering, and the
// active-integration-only filter. Mirrors list-overdue-tasks.test.ts's
// exact coverage shape.
describe.skipIf(!process.env.DATABASE_URL)(
  "listStuckSupportTickets (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("returns an empty list for an organization with no tickets yet", async () => {
      const org = await seedOrganization(pool);

      const tickets = await listStuckSupportTickets(pool, org.id);

      expect(tickets).toEqual([]);
    });

    it("reads back a real open ticket with correct source provenance", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "zendesk",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "zendesk",
        "support_ticket",
      );
      const input = fixtureInput(job.id);

      const ingestResult = await ingestZendeskTicket(
        pool,
        org.id,
        integration.id,
        input,
      );

      const tickets = await listStuckSupportTickets(pool, org.id);

      expect(tickets).toHaveLength(1);
      const ticket = tickets[0];
      expect(ticket?.id).toBe(ingestResult.ticketId);
      expect(ticket?.subject).toBe(input.subject);
      expect(ticket?.status).toBe(input.status);
      expect(ticket?.assigneeName).toBe(input.assigneeName);
      expect(ticket?.source.system).toBe("zendesk");
      expect(ticket?.source.integrationId).toBe(integration.id);
      expect(ticket?.source.externalRecordId).toBe(input.externalRecordId);
    });

    it.each(["hold", "solved", "closed"])(
      "does not surface a %s ticket",
      async (status) => {
        const org = await seedOrganization(pool);
        const integration = await seedIntegration(pool, org.id, {
          sourceSystem: "zendesk",
        });
        const job = await seedSyncJob(
          pool,
          org.id,
          integration.id,
          "zendesk",
          "support_ticket",
        );

        await ingestZendeskTicket(
          pool,
          org.id,
          integration.id,
          fixtureInput(job.id, { status }),
        );

        const tickets = await listStuckSupportTickets(pool, org.id);

        expect(tickets).toEqual([]);
      },
    );

    it.each(["new", "open", "pending"])(
      "surfaces a %s ticket",
      async (status) => {
        const org = await seedOrganization(pool);
        const integration = await seedIntegration(pool, org.id, {
          sourceSystem: "zendesk",
        });
        const job = await seedSyncJob(
          pool,
          org.id,
          integration.id,
          "zendesk",
          "support_ticket",
        );

        await ingestZendeskTicket(
          pool,
          org.id,
          integration.id,
          fixtureInput(job.id, { status }),
        );

        const tickets = await listStuckSupportTickets(pool, org.id);

        expect(tickets).toHaveLength(1);
      },
    );

    it("orders tickets oldest-activity-first", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "zendesk",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "zendesk",
        "support_ticket",
      );
      const recentlyStuck = await ingestZendeskTicket(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          lastActivityAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        }),
      );
      const longStuck = await ingestZendeskTicket(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          lastActivityAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        }),
      );

      const tickets = await listStuckSupportTickets(pool, org.id);

      expect(tickets.map((ticket) => ticket.id)).toEqual([
        longStuck.ticketId,
        recentlyStuck.ticketId,
      ]);
    });

    it("cannot see another organization's tickets", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await seedIntegration(pool, orgB.id, {
        sourceSystem: "zendesk",
      });
      const job = await seedSyncJob(
        pool,
        orgB.id,
        integrationB.id,
        "zendesk",
        "support_ticket",
      );

      await ingestZendeskTicket(
        pool,
        orgB.id,
        integrationB.id,
        fixtureInput(job.id),
      );

      const tickets = await listStuckSupportTickets(pool, orgA.id);

      expect(tickets).toEqual([]);
    });

    it("stops surfacing a ticket once its source integration is disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "zendesk",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "zendesk",
        "support_ticket",
      );
      await ingestZendeskTicket(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id),
      );

      expect(await listStuckSupportTickets(pool, org.id)).toHaveLength(1);

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [integration.id],
        );
      });

      const tickets = await listStuckSupportTickets(pool, org.id);

      expect(tickets).toEqual([]);
    });

    it("still surfaces a ticket when its source integration is degraded, not disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "zendesk",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "zendesk",
        "support_ticket",
      );
      await ingestZendeskTicket(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id),
      );

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'degraded' where id = $1",
          [integration.id],
        );
      });

      const tickets = await listStuckSupportTickets(pool, org.id);

      expect(tickets).toHaveLength(1);
    });
  },
);

// getSupportTicketById backs the ticket-detail drawer
// (apps/web/app/tickets/[id]) — unlike listStuckSupportTickets, it must
// honestly return a ticket regardless of status/integration health (a
// detail view for a solved/closed/disconnected-source ticket should
// still work), and must return null rather than throw for a real
// not-found or cross-tenant case.
describe.skipIf(!process.env.DATABASE_URL)(
  "getSupportTicketById (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("returns null for a ticket id that does not exist", async () => {
      const org = await seedOrganization(pool);

      const ticket = await getSupportTicketById(pool, org.id, randomUUID());

      expect(ticket).toBeNull();
    });

    it("returns the real ticket by id", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "zendesk",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "zendesk",
        "support_ticket",
      );
      const ingestResult = await ingestZendeskTicket(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id),
      );

      expect(ingestResult.ticketId).not.toBeNull();
      const ticket = await getSupportTicketById(
        pool,
        org.id,
        ingestResult.ticketId!,
      );

      expect(ticket?.id).toBe(ingestResult.ticketId);
      expect(ticket?.subject).toBe("Cannot log in");
    });

    it.each(["hold", "solved", "closed"])(
      "still returns a %s ticket (unlike listStuckSupportTickets)",
      async (status) => {
        const org = await seedOrganization(pool);
        const integration = await seedIntegration(pool, org.id, {
          sourceSystem: "zendesk",
        });
        const job = await seedSyncJob(
          pool,
          org.id,
          integration.id,
          "zendesk",
          "support_ticket",
        );
        const ingestResult = await ingestZendeskTicket(
          pool,
          org.id,
          integration.id,
          fixtureInput(job.id, { status }),
        );

        expect(ingestResult.ticketId).not.toBeNull();
        const ticket = await getSupportTicketById(
          pool,
          org.id,
          ingestResult.ticketId!,
        );

        expect(ticket?.status).toBe(status);
      },
    );

    it("returns null for another organization's real ticket (no cross-tenant leak)", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await seedIntegration(pool, orgB.id, {
        sourceSystem: "zendesk",
      });
      const job = await seedSyncJob(
        pool,
        orgB.id,
        integrationB.id,
        "zendesk",
        "support_ticket",
      );
      const ingestResult = await ingestZendeskTicket(
        pool,
        orgB.id,
        integrationB.id,
        fixtureInput(job.id),
      );

      expect(ingestResult.ticketId).not.toBeNull();
      const ticket = await getSupportTicketById(
        pool,
        orgA.id,
        ingestResult.ticketId!,
      );

      expect(ticket).toBeNull();
    });
  },
);
