import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { ingestHubSpotDeal } from "../src/hubspot-sync";
import { provisionIdentityAndOrganization } from "../src/identity";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedOrganization,
  seedSyncJob,
} from "./support";

function fixtureInput(
  syncJobId: string,
  overrides: Partial<Parameters<typeof ingestHubSpotDeal>[3]> = {},
) {
  return {
    externalRecordId: `deal-${randomUUID()}`,
    sourceVersion: "2026-08-18T13:56:00.000Z",
    rawPayloadSha256: "a".repeat(64),
    rawPayloadByteLength: 512,
    observedAt: new Date(),
    contactName: "Acme Robotics — Q3 Contract",
    companyName: "Acme Robotics — Q3 Contract",
    stage: "qualifiedtobuy",
    valueCents: 1_840_000,
    currency: "USD",
    expectedResponseHours: 24,
    sourceCreatedAt: new Date("2026-08-17T17:00:00.000Z"),
    lastInteractionAt: null,
    syncJobId,
    ownerName: null,
    ...overrides,
  };
}

// Exercises ingestHubSpotDeal against the live database: a real
// source_records → leads write, idempotency on repeat ingestion of the
// same source_version, and that the resulting lead satisfies the same
// immutability/tenant-isolation rules every other lead does.
describe.skipIf(!process.env.DATABASE_URL)(
  "hubspot sync (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("writes a real source_record and a matching lead", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(pool, org.id, integration.id, "hubspot");
      const input = fixtureInput(job.id);

      const result = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        input,
      );

      expect(result.inserted).toBe(true);
      expect(result.sourceRecordId).not.toBeNull();
      expect(result.leadId).not.toBeNull();

      const [sourceRecordRow, leadRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const sourceRecordResult = await client.query(
            "select source_system, source_object_type, external_record_id from source_records where id = $1",
            [result.sourceRecordId],
          );
          const leadResult = await client.query(
            "select contact_name, company_name, stage, value_cents, currency, owner_membership_id from leads where id = $1",
            [result.leadId],
          );
          return [sourceRecordResult.rows[0], leadResult.rows[0]];
        },
      );

      expect(sourceRecordRow).toEqual({
        source_system: "hubspot",
        source_object_type: "deal",
        external_record_id: input.externalRecordId,
      });
      expect(leadRow).toEqual({
        contact_name: input.contactName,
        company_name: input.companyName,
        stage: input.stage,
        value_cents: String(input.valueCents),
        currency: input.currency,
        owner_membership_id: null,
      });
    });

    it("is idempotent for the same external record at the same source version", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(pool, org.id, integration.id, "hubspot");
      const input = fixtureInput(job.id);

      const first = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        input,
      );
      const second = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        input,
      );

      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(false);
      expect(second.sourceRecordId).toBeNull();
    });

    it("resolves owner_membership_id when ownerName exactly matches a real member's display name", async () => {
      const displayName = `Maya Chen ${randomUUID()}`;
      const { organizationId } = await provisionIdentityAndOrganization(pool, {
        identityProvider: "test",
        identityProviderSubject: `subject-${randomUUID()}`,
        displayName,
        primaryEmail: `${randomUUID()}@example.com`,
      });
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(
        pool,
        organizationId,
        integration.id,
        "hubspot",
      );

      const result = await ingestHubSpotDeal(
        pool,
        organizationId,
        integration.id,
        fixtureInput(job.id, { ownerName: displayName }),
      );

      const [leadRow] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const leadResult = await client.query(
            "select owner_membership_id from leads where id = $1",
            [result.leadId],
          );
          return leadResult.rows;
        },
      );

      expect(leadRow?.owner_membership_id).not.toBeNull();
    });

    it("leaves owner_membership_id null when ownerName matches no real member", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(pool, org.id, integration.id, "hubspot");

      const result = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, { ownerName: "Nobody Real" }),
      );

      const [leadRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const leadResult = await client.query(
            "select owner_membership_id from leads where id = $1",
            [result.leadId],
          );
          return leadResult.rows;
        },
      );

      expect(leadRow?.owner_membership_id).toBeNull();
    });

    it("cannot see another organization's ingested leads", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationA = await seedIntegration(pool, orgA.id, {
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(pool, orgA.id, integrationA.id, "hubspot");

      const result = await ingestHubSpotDeal(
        pool,
        orgA.id,
        integrationA.id,
        fixtureInput(job.id),
      );

      const rows = await withTenantContext(pool, orgB.id, async (client) => {
        const leadResult = await client.query(
          "select id from leads where id = $1",
          [result.leadId],
        );
        return leadResult.rows;
      });

      expect(rows).toHaveLength(0);
    });
  },
);
