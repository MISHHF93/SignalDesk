import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectMicrosoftOutlookIntegration,
  findOrCreateMicrosoftOutlookIntegration,
  getMicrosoftOutlookIntegrationStatus,
} from "../src/microsoft-outlook-integration";
import { getTestPool, seedOrganization } from "./support";

// Mirrors gmail-integration.test.ts's coverage exactly.
describe.skipIf(!process.env.DATABASE_URL)(
  "microsoft outlook integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new Microsoft account, with a real label", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateMicrosoftOutlookIntegration(
        pool,
        org.id,
        "ms-oid-92001",
        "alex@example.test",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe("alex@example.test");
    });

    it("reuses the same row for the same Microsoft account rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateMicrosoftOutlookIntegration(
        pool,
        org.id,
        "ms-oid-92002",
        "reuse@example.test",
      );
      const second = await findOrCreateMicrosoftOutlookIntegration(
        pool,
        org.id,
        "ms-oid-92002",
        "reuse@example.test",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different Microsoft account", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateMicrosoftOutlookIntegration(
        pool,
        org.id,
        "ms-oid-92003",
        "one@example.test",
      );
      const second = await findOrCreateMicrosoftOutlookIntegration(
        pool,
        org.id,
        "ms-oid-92004",
        "two@example.test",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateMicrosoftOutlookIntegration(
        pool,
        org.id,
        "ms-oid-92006",
        "disconnect@example.test",
      );

      await disconnectMicrosoftOutlookIntegration(pool, org.id, integration.id);

      const status = await getMicrosoftOutlookIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateMicrosoftOutlookIntegration(
        pool,
        org.id,
        "ms-oid-92007",
        "reconnect@example.test",
      );

      await disconnectMicrosoftOutlookIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateMicrosoftOutlookIntegration(
        pool,
        org.id,
        "ms-oid-92007",
        "reconnect@example.test",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateMicrosoftOutlookIntegration(
        pool,
        orgB.id,
        "ms-oid-92008",
        "foreign@example.test",
      );

      await expect(
        disconnectMicrosoftOutlookIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
