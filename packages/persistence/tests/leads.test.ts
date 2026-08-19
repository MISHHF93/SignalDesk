import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { ingestHubSpotDeal } from "../src/hubspot-sync";
import { getPriorityLead } from "../src/leads";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

function fixtureInput(
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
    ...overrides,
  };
}

// Exercises getPriorityLead against the live database — the join across
// leads/source_records/memberships/users, and the "oldest untouched lead
// first, else most recent" selection heuristic.
describe.skipIf(!process.env.DATABASE_URL)(
  "getPriorityLead (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("returns null for an organization with no leads yet", async () => {
      const org = await seedOrganization(pool);

      const lead = await getPriorityLead(pool, org.id);

      expect(lead).toBeNull();
    });

    it("reads back a real ingested lead with correct source provenance", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const input = fixtureInput();

      const ingestResult = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        input,
      );

      const lead = await getPriorityLead(pool, org.id);

      expect(lead).not.toBeNull();
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

    it("prefers the oldest untouched lead over a more recent, already-touched one", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });

      const touchedRecent = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        fixtureInput({
          sourceCreatedAt: new Date("2026-08-18T10:00:00.000Z"),
          lastInteractionAt: new Date("2026-08-18T11:00:00.000Z"),
        }),
      );
      const untouchedOld = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        fixtureInput({
          sourceCreatedAt: new Date("2026-08-01T10:00:00.000Z"),
          lastInteractionAt: null,
        }),
      );

      const lead = await getPriorityLead(pool, org.id);

      expect(lead?.id).toBe(untouchedOld.leadId);
      expect(lead?.id).not.toBe(touchedRecent.leadId);
    });

    it("cannot see another organization's leads", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await seedIntegration(pool, orgB.id, {
        sourceSystem: "hubspot",
      });

      await ingestHubSpotDeal(pool, orgB.id, integrationB.id, fixtureInput());

      const lead = await getPriorityLead(pool, orgA.id);

      expect(lead).toBeNull();
    });

    it("stops surfacing a lead once its source integration is disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const ingestResult = await ingestHubSpotDeal(
        pool,
        org.id,
        integration.id,
        fixtureInput(),
      );

      expect(await getPriorityLead(pool, org.id)).not.toBeNull();

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [integration.id],
        );
      });

      const lead = await getPriorityLead(pool, org.id);

      expect(lead).toBeNull();
      expect(ingestResult.leadId).not.toBeNull();
    });

    it("falls back to a different integration's lead when one is disconnected", async () => {
      const org = await seedOrganization(pool);
      const hubspotIntegration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      const otherIntegration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
        externalAccountId: "second-hubspot-account",
      });

      await ingestHubSpotDeal(
        pool,
        org.id,
        hubspotIntegration.id,
        fixtureInput({
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
        fixtureInput({
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

      const lead = await getPriorityLead(pool, org.id);

      expect(lead?.id).toBe(secondLead.leadId);
    });
  },
);
