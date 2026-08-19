import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectLinearIntegration,
  findOrCreateLinearIntegration,
  getLinearIntegrationStatus,
} from "../src/linear-integration";
import { getTestPool, seedOrganization } from "./support";

// Mirrors asana-integration.test.ts's coverage exactly.
describe.skipIf(!process.env.DATABASE_URL)(
  "linear integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new Linear user, with a real label", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateLinearIntegration(
        pool,
        org.id,
        "linear-usr-95001",
        "alex@example.test",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe("alex@example.test");
    });

    it("reuses the same row for the same Linear user rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateLinearIntegration(
        pool,
        org.id,
        "linear-usr-95002",
        "reuse@example.test",
      );
      const second = await findOrCreateLinearIntegration(
        pool,
        org.id,
        "linear-usr-95002",
        "reuse@example.test",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different Linear user", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateLinearIntegration(
        pool,
        org.id,
        "linear-usr-95003",
        "one@example.test",
      );
      const second = await findOrCreateLinearIntegration(
        pool,
        org.id,
        "linear-usr-95004",
        "two@example.test",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateLinearIntegration(
        pool,
        org.id,
        "linear-usr-95006",
        "disconnect@example.test",
      );

      await disconnectLinearIntegration(pool, org.id, integration.id);

      const status = await getLinearIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateLinearIntegration(
        pool,
        org.id,
        "linear-usr-95007",
        "reconnect@example.test",
      );

      await disconnectLinearIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateLinearIntegration(
        pool,
        org.id,
        "linear-usr-95007",
        "reconnect@example.test",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateLinearIntegration(
        pool,
        orgB.id,
        "linear-usr-95008",
        "foreign@example.test",
      );

      await expect(
        disconnectLinearIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
