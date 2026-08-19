import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectHubSpotIntegration,
  findOrCreateHubSpotIntegration,
  getHubSpotIntegrationStatus,
} from "../src/hubspot-integration";
import { getHubSpotTokens, storeHubSpotTokens } from "../src/hubspot-tokens";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedOrganization } from "./support";

// Exercises findOrCreateHubSpotIntegration against the live database,
// including against the real immutable-column trigger on `integrations`
// (0003) that makes external_account_id write-once — proving the
// find-existing-row-by-hub-id path never attempts to touch it.
describe.skipIf(!process.env.DATABASE_URL)(
  "hubspot integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new hub", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateHubSpotIntegration(
        pool,
        org.id,
        "62515",
      );

      expect(integration.status).toBe("active");

      const row = await withTenantContext(pool, org.id, async (client) => {
        const result = await client.query(
          "select source_system, external_account_id, status from integrations where id = $1",
          [integration.id],
        );
        return result.rows[0];
      });

      expect(row).toEqual({
        source_system: "hubspot",
        external_account_id: "62515",
        status: "active",
      });
    });

    it("reuses the same row for the same hub id rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateHubSpotIntegration(pool, org.id, "77001");
      const second = await findOrCreateHubSpotIntegration(
        pool,
        org.id,
        "77001",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different hub id", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateHubSpotIntegration(pool, org.id, "11111");
      const second = await findOrCreateHubSpotIntegration(
        pool,
        org.id,
        "22222",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("deletes the real Vault secret and marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateHubSpotIntegration(
        pool,
        org.id,
        "88001",
      );

      await storeHubSpotTokens(pool, org.id, integration.id, {
        accessToken: "at-1",
        refreshToken: "rt-1",
        expiresAt: new Date(Date.now() + 3_600_000),
      });

      await disconnectHubSpotIntegration(pool, org.id, integration.id);

      const tokens = await getHubSpotTokens(pool, org.id, integration.id);
      expect(tokens).toBeNull();

      const row = await withTenantContext(pool, org.id, async (client) => {
        const result = await client.query(
          "select status, token_vault_secret_id from integrations where id = $1",
          [integration.id],
        );
        return result.rows[0];
      });

      expect(row).toEqual({
        status: "disconnected",
        token_vault_secret_id: null,
      });
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateHubSpotIntegration(
        pool,
        org.id,
        "88002",
      );

      await disconnectHubSpotIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateHubSpotIntegration(
        pool,
        org.id,
        "88002",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");

      await storeHubSpotTokens(pool, org.id, reconnected.id, {
        accessToken: "at-2",
        refreshToken: "rt-2",
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      const tokens = await getHubSpotTokens(pool, org.id, reconnected.id);
      expect(tokens?.accessToken).toBe("at-2");
    });

    it("reports the active hub, not the most recently created (but now disconnected) one", async () => {
      const org = await seedOrganization(pool);

      const hubA = await findOrCreateHubSpotIntegration(pool, org.id, "99001");
      await disconnectHubSpotIntegration(pool, org.id, hubA.id);

      // A second, newer HubSpot account row — connected, then also
      // disconnected, so it's the most recent row by created_at but not
      // the active one.
      const hubB = await findOrCreateHubSpotIntegration(pool, org.id, "99002");
      await disconnectHubSpotIntegration(pool, org.id, hubB.id);

      const reconnectedHubA = await findOrCreateHubSpotIntegration(
        pool,
        org.id,
        "99001",
      );

      expect(reconnectedHubA.id).toBe(hubA.id);

      const status = await getHubSpotIntegrationStatus(pool, org.id);

      expect(status).toEqual({
        id: hubA.id,
        status: "active",
        externalAccountLabel: null,
      });
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateHubSpotIntegration(
        pool,
        orgB.id,
        "88003",
      );

      await expect(
        disconnectHubSpotIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
