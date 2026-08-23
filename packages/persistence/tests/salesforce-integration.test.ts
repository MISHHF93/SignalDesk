import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectSalesforceIntegration,
  findOrCreateSalesforceIntegration,
  getSalesforceIntegrationStatus,
} from "../src/salesforce-integration";
import {
  getSalesforceTokens,
  storeSalesforceTokens,
} from "../src/salesforce-tokens";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedOrganization } from "./support";

// Exercises findOrCreateSalesforceIntegration against the live database,
// including against the real immutable-column trigger on `integrations`
// (0003) that makes external_account_id write-once — mirrors
// hubspot-integration.test.ts exactly, adapted for the label-from-day-one
// shape slack-integration.ts's own tests already established (Salesforce's
// token response, like Slack's, does carry a real human-readable
// identifier — its instance hostname — unlike HubSpot's bare hub id).
describe.skipIf(!process.env.DATABASE_URL)(
  "salesforce integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new org, with a real label", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-62515.my.salesforce.com",
        "test-62515.my.salesforce.com",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe(
        "test-62515.my.salesforce.com",
      );
      expect(integration.externalAccountId).toBe(
        "https://test-62515.my.salesforce.com",
      );

      const row = await withTenantContext(pool, org.id, async (client) => {
        const result = await client.query(
          "select source_system, external_account_id, external_account_label, status from integrations where id = $1",
          [integration.id],
        );
        return result.rows[0];
      });

      expect(row).toEqual({
        source_system: "salesforce",
        external_account_id: "https://test-62515.my.salesforce.com",
        external_account_label: "test-62515.my.salesforce.com",
        status: "active",
      });
    });

    it("reuses the same row for the same instance URL rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-77001.my.salesforce.com",
        "test-77001.my.salesforce.com",
      );
      const second = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-77001.my.salesforce.com",
        "test-77001.my.salesforce.com",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different Salesforce org", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-11111.my.salesforce.com",
        "test-11111.my.salesforce.com",
      );
      const second = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-22222.my.salesforce.com",
        "test-22222.my.salesforce.com",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("deletes the real Vault secrets and marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-88001.my.salesforce.com",
        "test-88001.my.salesforce.com",
      );

      await storeSalesforceTokens(pool, org.id, integration.id, {
        accessToken: "at-1",
        refreshToken: "rt-1",
      });

      await disconnectSalesforceIntegration(pool, org.id, integration.id);

      const tokens = await getSalesforceTokens(pool, org.id, integration.id);
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
      const original = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-88002.my.salesforce.com",
        "test-88002.my.salesforce.com",
      );

      await disconnectSalesforceIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-88002.my.salesforce.com",
        "test-88002.my.salesforce.com",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");

      await storeSalesforceTokens(pool, org.id, reconnected.id, {
        accessToken: "at-2",
        refreshToken: "rt-2",
      });
      const tokens = await getSalesforceTokens(pool, org.id, reconnected.id);
      expect(tokens?.accessToken).toBe("at-2");
    });

    it("reports the active org, not the most recently created (but now disconnected) one", async () => {
      const org = await seedOrganization(pool);

      const orgA = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-99001.my.salesforce.com",
        "test-99001.my.salesforce.com",
      );
      await disconnectSalesforceIntegration(pool, org.id, orgA.id);

      // A second, newer Salesforce org row — connected, then also
      // disconnected, so it's the most recent row by created_at but not
      // the active one.
      const orgB = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-99002.my.salesforce.com",
        "test-99002.my.salesforce.com",
      );
      await disconnectSalesforceIntegration(pool, org.id, orgB.id);

      const reconnectedOrgA = await findOrCreateSalesforceIntegration(
        pool,
        org.id,
        "https://test-99001.my.salesforce.com",
        "test-99001.my.salesforce.com",
      );

      expect(reconnectedOrgA.id).toBe(orgA.id);

      const status = await getSalesforceIntegrationStatus(pool, org.id);

      expect(status).toEqual({
        id: orgA.id,
        status: "active",
        externalAccountLabel: "test-99001.my.salesforce.com",
        externalAccountId: "https://test-99001.my.salesforce.com",
      });
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateSalesforceIntegration(
        pool,
        orgB.id,
        "https://test-88003.my.salesforce.com",
        "test-88003.my.salesforce.com",
      );

      await expect(
        disconnectSalesforceIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
