import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { getSlackTokens, storeSlackTokens } from "../src/slack-tokens";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

// Mirrors hubspot-tokens.test.ts's coverage — same underlying Vault
// mechanism (0019's provider-neutral store_integration_tokens/
// get_integration_tokens), exercised via Slack's own thin wrapper, which
// passes null refresh token/expiry (Slack bot tokens don't have either by
// default, unlike HubSpot's).
describe.skipIf(!process.env.DATABASE_URL)(
  "slack tokens (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("round-trips a real encrypt/decrypt through Vault", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "slack",
      });

      await storeSlackTokens(pool, org.id, integration.id, {
        accessToken: "xoxb-test-token",
      });

      const tokens = await getSlackTokens(pool, org.id, integration.id);

      expect(tokens).not.toBeNull();
      expect(tokens?.accessToken).toBe("xoxb-test-token");
    });

    it("rotates the token in place on a second store", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "slack",
      });

      await storeSlackTokens(pool, org.id, integration.id, {
        accessToken: "xoxb-first-token",
      });
      await storeSlackTokens(pool, org.id, integration.id, {
        accessToken: "xoxb-rotated-token",
      });

      const tokens = await getSlackTokens(pool, org.id, integration.id);

      expect(tokens?.accessToken).toBe("xoxb-rotated-token");
    });

    it("returns null for an integration with no stored tokens yet", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "slack",
      });

      const tokens = await getSlackTokens(pool, org.id, integration.id);

      expect(tokens).toBeNull();
    });

    it("never leaks tokens across tenants", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integration = await seedIntegration(pool, orgA.id, {
        sourceSystem: "slack",
      });

      await storeSlackTokens(pool, orgA.id, integration.id, {
        accessToken: "xoxb-org-a-secret",
      });

      const tokens = await getSlackTokens(pool, orgB.id, integration.id);

      expect(tokens).toBeNull();
    });

    it("rejects storing a token for an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integration = await seedIntegration(pool, orgA.id, {
        sourceSystem: "slack",
      });

      await expect(
        storeSlackTokens(pool, orgB.id, integration.id, {
          accessToken: "xoxb-should-not-store",
        }),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
