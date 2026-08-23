import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { provisionIdentityAndOrganization } from "../src/identity";
import { ingestZendeskTicket } from "../src/zendesk-sync";
import { withTenantContext } from "../src/tenant-context";
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
    lastActivityAt: new Date("2026-08-18T13:56:00.000Z"),
    syncJobId,
    ...overrides,
  };
}

// Exercises ingestZendeskTicket against the live database: a real
// source_records → support_tickets write, idempotency on repeat ingestion
// of the same source_version, real owner_membership_id resolution (ADR
// 0039), and that support_tickets carry the same tenant-isolation
// guarantees every other normalized entity does.
describe.skipIf(!process.env.DATABASE_URL)(
  "zendesk sync (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("writes a real source_record and a matching support_ticket", async () => {
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

      const result = await ingestZendeskTicket(
        pool,
        org.id,
        integration.id,
        input,
      );

      expect(result.inserted).toBe(true);
      expect(result.sourceRecordId).not.toBeNull();
      expect(result.ticketId).not.toBeNull();

      const [sourceRecordRow, ticketRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const sourceRecordResult = await client.query(
            "select source_system, source_object_type, external_record_id from source_records where id = $1",
            [result.sourceRecordId],
          );
          const ticketResult = await client.query(
            `select subject, status, priority, requester_name, assignee_name, due_at
             from support_tickets where id = $1`,
            [result.ticketId],
          );
          return [sourceRecordResult.rows[0], ticketResult.rows[0]];
        },
      );

      expect(sourceRecordRow).toEqual({
        source_system: "zendesk",
        source_object_type: "ticket",
        external_record_id: input.externalRecordId,
      });
      expect(ticketRow).toEqual({
        subject: input.subject,
        status: input.status,
        priority: input.priority,
        requester_name: input.requesterName,
        assignee_name: input.assigneeName,
        due_at: input.dueAt,
      });
    });

    it("is idempotent for the same external record at the same source version", async () => {
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

      const first = await ingestZendeskTicket(
        pool,
        org.id,
        integration.id,
        input,
      );
      const second = await ingestZendeskTicket(
        pool,
        org.id,
        integration.id,
        input,
      );

      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(false);
      expect(second.sourceRecordId).toBeNull();
    });

    it("cannot see another organization's ingested tickets", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationA = await seedIntegration(pool, orgA.id, {
        sourceSystem: "zendesk",
      });
      const job = await seedSyncJob(
        pool,
        orgA.id,
        integrationA.id,
        "zendesk",
        "support_ticket",
      );

      const result = await ingestZendeskTicket(
        pool,
        orgA.id,
        integrationA.id,
        fixtureInput(job.id),
      );

      const rows = await withTenantContext(pool, orgB.id, async (client) => {
        const ticketResult = await client.query(
          "select id from support_tickets where id = $1",
          [result.ticketId],
        );
        return ticketResult.rows;
      });

      expect(rows).toHaveLength(0);
    });

    it("resolves owner_membership_id when assigneeName exactly matches a real member's display name", async () => {
      const displayName = `Jamie Rivera ${randomUUID()}`;
      const { organizationId } = await provisionIdentityAndOrganization(pool, {
        identityProvider: "test",
        identityProviderSubject: `subject-${randomUUID()}`,
        displayName,
        primaryEmail: `${randomUUID()}@example.com`,
      });
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "zendesk",
      });
      const job = await seedSyncJob(
        pool,
        organizationId,
        integration.id,
        "zendesk",
        "support_ticket",
      );

      const result = await ingestZendeskTicket(
        pool,
        organizationId,
        integration.id,
        fixtureInput(job.id, { assigneeName: displayName }),
      );

      const [ticketRow] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const ticketResult = await client.query(
            "select owner_membership_id from support_tickets where id = $1",
            [result.ticketId],
          );
          return ticketResult.rows;
        },
      );

      expect(ticketRow?.owner_membership_id).not.toBeNull();
    });

    it("leaves owner_membership_id null when assigneeName matches no real member", async () => {
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

      const result = await ingestZendeskTicket(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, { assigneeName: "Nobody Real" }),
      );

      const [ticketRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const ticketResult = await client.query(
            "select owner_membership_id from support_tickets where id = $1",
            [result.ticketId],
          );
          return ticketResult.rows;
        },
      );

      expect(ticketRow?.owner_membership_id).toBeNull();
    });
  },
);
