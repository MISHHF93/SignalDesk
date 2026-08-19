import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectAsanaIntegration,
  findOrCreateAsanaIntegration,
  getAsanaIntegrationStatus,
} from "../src/asana-integration";
import { getTestPool, seedOrganization } from "./support";

// Mirrors gmail-integration.test.ts's coverage exactly.
describe.skipIf(!process.env.DATABASE_URL)(
  "asana integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new Asana user, with a real label", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateAsanaIntegration(
        pool,
        org.id,
        "asana-gid-94001",
        "alex@example.test",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe("alex@example.test");
    });

    it("reuses the same row for the same Asana user rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateAsanaIntegration(
        pool,
        org.id,
        "asana-gid-94002",
        "reuse@example.test",
      );
      const second = await findOrCreateAsanaIntegration(
        pool,
        org.id,
        "asana-gid-94002",
        "reuse@example.test",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different Asana user", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateAsanaIntegration(
        pool,
        org.id,
        "asana-gid-94003",
        "one@example.test",
      );
      const second = await findOrCreateAsanaIntegration(
        pool,
        org.id,
        "asana-gid-94004",
        "two@example.test",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateAsanaIntegration(
        pool,
        org.id,
        "asana-gid-94006",
        "disconnect@example.test",
      );

      await disconnectAsanaIntegration(pool, org.id, integration.id);

      const status = await getAsanaIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateAsanaIntegration(
        pool,
        org.id,
        "asana-gid-94007",
        "reconnect@example.test",
      );

      await disconnectAsanaIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateAsanaIntegration(
        pool,
        org.id,
        "asana-gid-94007",
        "reconnect@example.test",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateAsanaIntegration(
        pool,
        orgB.id,
        "asana-gid-94008",
        "foreign@example.test",
      );

      await expect(
        disconnectAsanaIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
