import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectJiraIntegration,
  findOrCreateJiraIntegration,
  getJiraIntegrationStatus,
} from "../src/jira-integration";
import { getTestPool, seedOrganization } from "./support";

// Mirrors asana-integration.test.ts's coverage exactly, keyed by cloudId
// instead of an Asana user gid.
describe.skipIf(!process.env.DATABASE_URL)(
  "jira integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new Jira site, with a real label", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateJiraIntegration(
        pool,
        org.id,
        "cloud-94001",
        "Acme Robotics",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe("Acme Robotics");
      expect(integration.externalAccountId).toBe("cloud-94001");
    });

    it("reuses the same row for the same cloudId rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateJiraIntegration(
        pool,
        org.id,
        "cloud-94002",
        "Reuse Site",
      );
      const second = await findOrCreateJiraIntegration(
        pool,
        org.id,
        "cloud-94002",
        "Reuse Site",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different cloudId", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateJiraIntegration(
        pool,
        org.id,
        "cloud-94003",
        "Site One",
      );
      const second = await findOrCreateJiraIntegration(
        pool,
        org.id,
        "cloud-94004",
        "Site Two",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateJiraIntegration(
        pool,
        org.id,
        "cloud-94006",
        "Disconnect Site",
      );

      await disconnectJiraIntegration(pool, org.id, integration.id);

      const status = await getJiraIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateJiraIntegration(
        pool,
        org.id,
        "cloud-94007",
        "Reconnect Site",
      );

      await disconnectJiraIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateJiraIntegration(
        pool,
        org.id,
        "cloud-94007",
        "Reconnect Site",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateJiraIntegration(
        pool,
        orgB.id,
        "cloud-94008",
        "Foreign Site",
      );

      await expect(
        disconnectJiraIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
