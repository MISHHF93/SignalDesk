import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectQuickBooksIntegration,
  findOrCreateQuickBooksIntegration,
  getQuickBooksIntegrationStatus,
} from "../src/quickbooks-integration";
import {
  getQuickBooksTokens,
  storeQuickBooksTokens,
} from "../src/quickbooks-tokens";
import { getTestPool, seedOrganization } from "./support";

// Mirrors hubspot-integration.test.ts's coverage — same atomic-upsert
// pattern, same disconnect mechanism (0019's provider-neutral
// disconnect_integration), keyed by realmId instead of hub id.
describe.skipIf(!process.env.DATABASE_URL)(
  "quickbooks integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new company", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000001",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBeNull();
    });

    it("reuses the same row for the same realm id rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000002",
      );
      const second = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000002",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different realm id", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000003",
      );
      const second = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000004",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("deletes the real Vault secret and marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000005",
      );

      await storeQuickBooksTokens(pool, org.id, integration.id, {
        accessToken: "at-1",
        refreshToken: "rt-1",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      await disconnectQuickBooksIntegration(pool, org.id, integration.id);

      const tokens = await getQuickBooksTokens(pool, org.id, integration.id);
      expect(tokens).toBeNull();

      const status = await getQuickBooksIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000006",
      );

      await disconnectQuickBooksIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000006",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("reports the active company, not the most recently created (but now disconnected) one", async () => {
      const org = await seedOrganization(pool);

      const companyA = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000007",
      );
      await disconnectQuickBooksIntegration(pool, org.id, companyA.id);

      const companyB = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000008",
      );
      await disconnectQuickBooksIntegration(pool, org.id, companyB.id);

      const reconnectedA = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000007",
      );

      const status = await getQuickBooksIntegrationStatus(pool, org.id);

      expect(status?.id).toBe(reconnectedA.id);
      expect(status?.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateQuickBooksIntegration(
        pool,
        orgB.id,
        "9130350000000009",
      );

      await expect(
        disconnectQuickBooksIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
