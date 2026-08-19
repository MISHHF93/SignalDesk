import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectStripeIntegration,
  findOrCreateStripeIntegration,
  getStripeIntegrationStatus,
} from "../src/stripe-integration";
import { getTestPool, seedOrganization } from "./support";

// Mirrors hubspot-integration.test.ts's coverage for the parts that apply
// — same atomic-upsert pattern, same disconnect mechanism (0019's
// provider-neutral disconnect_integration) — but has no token round-trip
// tests, since Stripe never stores one (see stripe-integration.ts's doc
// comment on why).
describe.skipIf(!process.env.DATABASE_URL)(
  "stripe integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new account, exposing the account id", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99001",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountId).toBe("acct_99001");
      // Stripe's OAuth response carries no human-readable business name
      // (see the client's doc comment on the deprecated response fields),
      // so this stays null today — same honest gap as HubSpot's.
      expect(integration.externalAccountLabel).toBeNull();
    });

    it("reuses the same row for the same account id rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99002",
      );
      const second = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99002",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different account id", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99003",
      );
      const second = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99004",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("marks the integration disconnected without ever having stored a Vault secret", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99005",
      );

      await disconnectStripeIntegration(pool, org.id, integration.id);

      const status = await getStripeIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99006",
      );

      await disconnectStripeIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99006",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("reports the active account, not the most recently created (but now disconnected) one", async () => {
      const org = await seedOrganization(pool);

      const accountA = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99007",
      );
      await disconnectStripeIntegration(pool, org.id, accountA.id);

      const accountB = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99008",
      );
      await disconnectStripeIntegration(pool, org.id, accountB.id);

      const reconnectedA = await findOrCreateStripeIntegration(
        pool,
        org.id,
        "acct_99007",
      );

      const status = await getStripeIntegrationStatus(pool, org.id);

      expect(status?.id).toBe(reconnectedA.id);
      expect(status?.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateStripeIntegration(
        pool,
        orgB.id,
        "acct_99009",
      );

      await expect(
        disconnectStripeIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
