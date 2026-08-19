import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectSlackIntegration,
  findOrCreateSlackIntegration,
  getSlackIntegrationStatus,
} from "../src/slack-integration";
import { getSlackTokens, storeSlackTokens } from "../src/slack-tokens";
import { getTestPool, seedOrganization } from "./support";

// Mirrors hubspot-integration.test.ts's coverage — same atomic-upsert
// pattern, same disconnect mechanism (0019's provider-neutral
// disconnect_integration), exercised via Slack's own thin wrapper.
describe.skipIf(!process.env.DATABASE_URL)(
  "slack integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new workspace, with a real account label", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99001",
        "Acme Agency",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe("Acme Agency");
    });

    it("reuses the same row for the same team id rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99002",
        "Reuse Workspace",
      );
      const second = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99002",
        "Reuse Workspace",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different team id", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99003",
        "Workspace One",
      );
      const second = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99004",
        "Workspace Two",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("deletes the real Vault secret and marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99005",
        "Disconnect Workspace",
      );

      await storeSlackTokens(pool, org.id, integration.id, {
        accessToken: "xoxb-to-be-revoked",
      });

      await disconnectSlackIntegration(pool, org.id, integration.id);

      const tokens = await getSlackTokens(pool, org.id, integration.id);
      expect(tokens).toBeNull();

      const status = await getSlackIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99006",
        "Reconnect Workspace",
      );

      await disconnectSlackIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99006",
        "Reconnect Workspace",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("reports the active workspace, not the most recently created (but now disconnected) one", async () => {
      const org = await seedOrganization(pool);

      const workspaceA = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99007",
        "Workspace A",
      );
      await disconnectSlackIntegration(pool, org.id, workspaceA.id);

      const workspaceB = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99008",
        "Workspace B",
      );
      await disconnectSlackIntegration(pool, org.id, workspaceB.id);

      const reconnectedA = await findOrCreateSlackIntegration(
        pool,
        org.id,
        "T99007",
        "Workspace A",
      );

      const status = await getSlackIntegrationStatus(pool, org.id);

      expect(status?.id).toBe(reconnectedA.id);
      expect(status?.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateSlackIntegration(
        pool,
        orgB.id,
        "T99009",
        "Foreign Workspace",
      );

      await expect(
        disconnectSlackIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
