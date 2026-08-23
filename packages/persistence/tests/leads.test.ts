import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { ingestHubSpotDeal } from "../src/hubspot-sync";
import { listLeadsForAttention } from "../src/leads";
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

// Exercises listLeadsForAttention against the live database — the join
// across leads/source_records/memberships/users, the "oldest untouched
// lead first, else most recent" ordering, and the multi-lead cap
// (`MAX_LEADS_FOR_ATTENTION`) that replaced the previous single-record
// `getPriorityLead` stopgap.
describe.skipIf(!process.env.DATABASE_URL)(
  "listLeadsForAttention (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("returns an empty list for an organization with no leads yet", async () => {
      const org = await seedOrganization(pool);

      const leads = await listLeadsForAttention(pool, org.id);

      expect(leads).toEqual([]);
    });

    it("reads back a real ingested lead with correct source provenance", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(pool, org.id, integration.id, "hubspot");
      const input = fixtureInput(job.id);

      const ingestResult = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        input,
      );

      const leads = await listLeadsForAttention(pool, org.id);

      expect(leads).toHaveLength(1);
      const lead = leads[0];
      expect(lead?.id).toBe(ingestResult.leadId);
      expect(lead?.contactName).toBe(input.contactName);
      expect(lead?.companyName).toBe(input.companyName);
      expect(lead?.valueCents).toBe(input.valueCents);
      expect(lead?.currency).toBe(input.currency);
      expect(lead?.owner).toBeNull();
      expect(lead?.lastInteractionAt).toBeNull();
      expect(lead?.source.system).toBe("hubspot");
      expect(lead?.source.integrationId).toBe(integration.id);
      expect(lead?.source.externalRecordId).toBe(input.externalRecordId);
      expect(lead?.source.sourceVersion).toBe(input.sourceVersion);
      expect(lead?.source.recordDigestSha256).toBe(input.rawPayloadSha256);
    });

    it("returns every at-risk lead, not just one — orders the oldest untouched lead first", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(pool, org.id, integration.id, "hubspot");

      const touchedRecent = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          sourceCreatedAt: new Date("2026-08-18T10:00:00.000Z"),
          lastInteractionAt: new Date("2026-08-18T11:00:00.000Z"),
        }),
      );
      const untouchedOld = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          sourceCreatedAt: new Date("2026-08-01T10:00:00.000Z"),
          lastInteractionAt: null,
        }),
      );

      const leads = await listLeadsForAttention(pool, org.id);
      const ids = leads.map((lead) => lead.id);

      // Both real leads are returned — the previous single-lead stopgap
      // silently hid whichever one this test didn't happen to pick.
      expect(ids).toContain(touchedRecent.leadId);
      expect(ids).toContain(untouchedOld.leadId);
      expect(ids.indexOf(untouchedOld.leadId!)).toBeLessThan(
        ids.indexOf(touchedRecent.leadId!),
      );
    });

    it("cannot see another organization's leads", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await seedIntegration(pool, orgB.id, {
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(pool, orgB.id, integrationB.id, "hubspot");

      await ingestHubSpotDeal(
        pool,
        orgB.id,
        integrationB.id,
        fixtureInput(job.id),
      );

      const leads = await listLeadsForAttention(pool, orgA.id);

      expect(leads).toEqual([]);
    });

    it("stops surfacing a lead once its source integration is disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(pool, org.id, integration.id, "hubspot");
      const ingestResult = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id),
      );

      expect(await listLeadsForAttention(pool, org.id)).toHaveLength(1);

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [integration.id],
        );
      });

      const leads = await listLeadsForAttention(pool, org.id);

      expect(leads).toEqual([]);
      expect(ingestResult.leadId).not.toBeNull();
    });

    it("still surfaces a lead when its source integration is degraded, not disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const job = await seedSyncJob(pool, org.id, integration.id, "hubspot");
      const ingestResult = await ingestHubSpotDeal(
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

      const leads = await listLeadsForAttention(pool, org.id);

      expect(leads.map((lead) => lead.id)).toContain(ingestResult.leadId);
    });

    it("keeps a different integration's lead visible when one integration is disconnected", async () => {
      const org = await seedOrganization(pool);
      const hubspotIntegration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const otherIntegration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
        externalAccountId: "second-hubspot-account",
      });
      const firstJob = await seedSyncJob(
        pool,
        org.id,
        hubspotIntegration.id,
        "hubspot",
      );
      const secondJob = await seedSyncJob(
        pool,
        org.id,
        otherIntegration.id,
        "hubspot",
      );

      await ingestHubSpotDeal(
        pool,
        org.id,
        hubspotIntegration.id,
        fixtureInput(firstJob.id, {
          sourceCreatedAt: new Date("2026-08-01T10:00:00.000Z"),
          lastInteractionAt: null,
        }),
      );

      // A second, distinct HubSpot integration row (a different connected
      // account) — proves the filter is per-integration, not per-connector.
      const secondLead = await ingestHubSpotDeal(
        pool,
        org.id,
        otherIntegration.id,
        fixtureInput(secondJob.id, {
          sourceCreatedAt: new Date("2026-08-05T10:00:00.000Z"),
          lastInteractionAt: null,
        }),
      );

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [hubspotIntegration.id],
        );
      });

      const leads = await listLeadsForAttention(pool, org.id);

      expect(leads).toHaveLength(1);
      expect(leads[0]?.id).toBe(secondLead.leadId);
    });
  },
);
