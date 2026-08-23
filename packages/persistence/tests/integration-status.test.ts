import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  listActiveIntegrationSourceSystems,
  listActiveIntegrations,
} from "../src/integration-status";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

// Exercises listActiveIntegrationSourceSystems against the live database —
// this is what feeds IntelligenceContext.connectedIntegrationSlugs, so an
// integration-health finding is only ever honest if this reads real state.
describe.skipIf(!process.env.DATABASE_URL)(
  "listActiveIntegrationSourceSystems (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("returns an empty list for an organization with no integrations", async () => {
      const org = await seedOrganization(pool);

      const slugs = await listActiveIntegrationSourceSystems(pool, org.id);

      expect(slugs).toEqual([]);
    });

    it("lists an active integration's source system", async () => {
      const org = await seedOrganization(pool);
      await seedIntegration(pool, org.id, { sourceSystem: "hubspot" });

      const slugs = await listActiveIntegrationSourceSystems(pool, org.id);

      expect(slugs).toEqual(["hubspot"]);
    });

    it("excludes an integration that isn't active", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [integration.id],
        );
      });

      const slugs = await listActiveIntegrationSourceSystems(pool, org.id);

      expect(slugs).toEqual([]);
    });

    it("still lists a degraded integration's source system", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'degraded' where id = $1",
          [integration.id],
        );
      });

      const slugs = await listActiveIntegrationSourceSystems(pool, org.id);

      expect(slugs).toEqual(["hubspot"]);
    });

    it("cannot see another organization's integrations", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      await seedIntegration(pool, orgB.id, { sourceSystem: "hubspot" });

      const slugs = await listActiveIntegrationSourceSystems(pool, orgA.id);

      expect(slugs).toEqual([]);
    });
  },
);

// listActiveIntegrations feeds account-deletion's disconnect-everything
// path (deleteOrganizationAction) — a degraded connection still holds a
// real Vault-stored credential that must be revoked too, so it must not
// be silently skipped.
describe.skipIf(!process.env.DATABASE_URL)(
  "listActiveIntegrations (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("includes a degraded integration, not just active ones", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'degraded' where id = $1",
          [integration.id],
        );
      });

      const integrations = await listActiveIntegrations(pool, org.id);

      expect(integrations).toEqual([
        { id: integration.id, sourceSystem: "hubspot" },
      ]);
    });

    it("excludes a disconnected integration", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [integration.id],
        );
      });

      const integrations = await listActiveIntegrations(pool, org.id);

      expect(integrations).toEqual([]);
    });
  },
);
