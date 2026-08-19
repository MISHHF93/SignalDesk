import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectGmailIntegration,
  findOrCreateGmailIntegration,
  getGmailIntegrationStatus,
} from "../src/gmail-integration";
import { getTestPool, seedOrganization } from "./support";

// Mirrors hubspot-integration.test.ts's coverage — same atomic-upsert
// pattern, same disconnect mechanism (0019's provider-neutral
// disconnect_integration), keyed by the Google account's id_token `sub`.
describe.skipIf(!process.env.DATABASE_URL)(
  "gmail integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new Google account, with a real label", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateGmailIntegration(
        pool,
        org.id,
        "google-sub-90001",
        "alex@example.test",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe("alex@example.test");
    });

    it("reuses the same row for the same Google account rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateGmailIntegration(
        pool,
        org.id,
        "google-sub-90002",
        "reuse@example.test",
      );
      const second = await findOrCreateGmailIntegration(
        pool,
        org.id,
        "google-sub-90002",
        "reuse@example.test",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different Google account", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateGmailIntegration(
        pool,
        org.id,
        "google-sub-90003",
        "one@example.test",
      );
      const second = await findOrCreateGmailIntegration(
        pool,
        org.id,
        "google-sub-90004",
        "two@example.test",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("allows a null email without failing the upsert", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateGmailIntegration(
        pool,
        org.id,
        "google-sub-90005",
        null,
      );

      expect(integration.externalAccountLabel).toBeNull();
    });

    it("marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateGmailIntegration(
        pool,
        org.id,
        "google-sub-90006",
        "disconnect@example.test",
      );

      await disconnectGmailIntegration(pool, org.id, integration.id);

      const status = await getGmailIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateGmailIntegration(
        pool,
        org.id,
        "google-sub-90007",
        "reconnect@example.test",
      );

      await disconnectGmailIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateGmailIntegration(
        pool,
        org.id,
        "google-sub-90007",
        "reconnect@example.test",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateGmailIntegration(
        pool,
        orgB.id,
        "google-sub-90008",
        "foreign@example.test",
      );

      await expect(
        disconnectGmailIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
