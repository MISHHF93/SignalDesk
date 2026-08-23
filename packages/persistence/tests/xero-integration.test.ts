import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectXeroIntegration,
  findOrCreateXeroIntegration,
  getXeroIntegrationStatus,
} from "../src/xero-integration";
import { getXeroTokens, storeXeroTokens } from "../src/xero-tokens";
import { getTestPool, seedOrganization } from "./support";

// Mirrors quickbooks-integration.test.ts's coverage — same atomic-upsert
// pattern, same disconnect mechanism (0019's provider-neutral
// disconnect_integration), keyed by tenantId instead of realmId, with a
// real label from day one (Xero's /connections response carries a real
// tenantName, unlike QuickBooks' bare realmId).
describe.skipIf(!process.env.DATABASE_URL)(
  "xero integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new organisation, with a real label", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-62515",
        "Acme Robotics Ltd",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe("Acme Robotics Ltd");
      expect(integration.externalAccountId).toBe("tenant-62515");
    });

    it("reuses the same row for the same tenant id rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-77001",
        "Org 77001",
      );
      const second = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-77001",
        "Org 77001",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different tenant id", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-11111",
        "Org 11111",
      );
      const second = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-22222",
        "Org 22222",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("deletes the real Vault secret and marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-88001",
        "Org 88001",
      );

      await storeXeroTokens(pool, org.id, integration.id, {
        accessToken: "at-1",
        refreshToken: "rt-1",
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      await disconnectXeroIntegration(pool, org.id, integration.id);

      const tokens = await getXeroTokens(pool, org.id, integration.id);
      expect(tokens).toBeNull();

      const status = await getXeroIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-88002",
        "Org 88002",
      );

      await disconnectXeroIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-88002",
        "Org 88002",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("reports the active organisation, not the most recently created (but now disconnected) one", async () => {
      const org = await seedOrganization(pool);

      const orgA = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-99001",
        "Org 99001",
      );
      await disconnectXeroIntegration(pool, org.id, orgA.id);

      const orgB = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-99002",
        "Org 99002",
      );
      await disconnectXeroIntegration(pool, org.id, orgB.id);

      const reconnectedOrgA = await findOrCreateXeroIntegration(
        pool,
        org.id,
        "tenant-99001",
        "Org 99001",
      );

      const status = await getXeroIntegrationStatus(pool, org.id);

      expect(status?.id).toBe(reconnectedOrgA.id);
      expect(status?.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateXeroIntegration(
        pool,
        orgB.id,
        "tenant-88003",
        "Org 88003",
      );

      await expect(
        disconnectXeroIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
