import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectZendeskIntegration,
  findOrCreateZendeskIntegration,
  getZendeskIntegrationStatus,
} from "../src/zendesk-integration";
import { getTestPool, seedOrganization } from "./support";

// Mirrors jira-integration.test.ts's coverage exactly, keyed by a real
// Zendesk subdomain (known up front from the connect form) instead of a
// discovered cloudId.
describe.skipIf(!process.env.DATABASE_URL)(
  "zendesk integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new Zendesk subdomain, with a real label", async () => {
      const org = await seedOrganization(pool);
      const subdomain = `acme-${randomUUID().slice(0, 8)}`;

      const integration = await findOrCreateZendeskIntegration(
        pool,
        org.id,
        subdomain,
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe(subdomain);
      expect(integration.externalAccountId).toBe(subdomain);
    });

    it("reuses the same row for the same subdomain rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);
      const subdomain = `reuse-${randomUUID().slice(0, 8)}`;

      const first = await findOrCreateZendeskIntegration(
        pool,
        org.id,
        subdomain,
      );
      const second = await findOrCreateZendeskIntegration(
        pool,
        org.id,
        subdomain,
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different subdomain", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateZendeskIntegration(
        pool,
        org.id,
        `site-one-${randomUUID().slice(0, 8)}`,
      );
      const second = await findOrCreateZendeskIntegration(
        pool,
        org.id,
        `site-two-${randomUUID().slice(0, 8)}`,
      );

      expect(second.id).not.toBe(first.id);
    });

    it("marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateZendeskIntegration(
        pool,
        org.id,
        `disconnect-${randomUUID().slice(0, 8)}`,
      );

      await disconnectZendeskIntegration(pool, org.id, integration.id);

      const status = await getZendeskIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const subdomain = `reconnect-${randomUUID().slice(0, 8)}`;
      const original = await findOrCreateZendeskIntegration(
        pool,
        org.id,
        subdomain,
      );

      await disconnectZendeskIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateZendeskIntegration(
        pool,
        org.id,
        subdomain,
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateZendeskIntegration(
        pool,
        orgB.id,
        `foreign-${randomUUID().slice(0, 8)}`,
      );

      await expect(
        disconnectZendeskIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
