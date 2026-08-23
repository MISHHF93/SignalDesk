import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  getSalesforceTokens,
  storeSalesforceTokens,
} from "../src/salesforce-tokens";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

// Exercises the Vault-backed token storage via the provider-neutral
// store_integration_tokens/get_integration_tokens (0019) — a real encrypt/
// store/decrypt/retrieve round trip against the live database, plus the
// cross-tenant isolation the underlying SECURITY DEFINER functions rely on
// RLS (not just an application check) to enforce. Mirrors hubspot-
// tokens.test.ts, minus expiresAt — Salesforce's OAuth response never
// discloses a token lifetime (see SalesforceTokenResponse's doc comment),
// so storeSalesforceTokens always passes a real `null` for it.
describe.skipIf(!process.env.DATABASE_URL)(
  "salesforce tokens (live database)",
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
        sourceSystem: "salesforce",
      });

      await storeSalesforceTokens(pool, org.id, integration.id, {
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
      });

      const tokens = await getSalesforceTokens(pool, org.id, integration.id);

      expect(tokens).not.toBeNull();
      expect(tokens?.accessToken).toBe("test-access-token");
      expect(tokens?.refreshToken).toBe("test-refresh-token");
    });

    it("rotates tokens in place on a second store", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "salesforce",
      });

      await storeSalesforceTokens(pool, org.id, integration.id, {
        accessToken: "first-token",
        refreshToken: "first-refresh",
      });

      await storeSalesforceTokens(pool, org.id, integration.id, {
        accessToken: "rotated-token",
        refreshToken: "rotated-refresh",
      });

      const tokens = await getSalesforceTokens(pool, org.id, integration.id);

      expect(tokens?.accessToken).toBe("rotated-token");
      expect(tokens?.refreshToken).toBe("rotated-refresh");
    });

    it("returns null for an integration with no stored tokens yet", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "salesforce",
      });

      const tokens = await getSalesforceTokens(pool, org.id, integration.id);

      expect(tokens).toBeNull();
    });

    it("never leaks tokens across tenants", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integration = await seedIntegration(pool, orgA.id, {
        sourceSystem: "salesforce",
      });

      await storeSalesforceTokens(pool, orgA.id, integration.id, {
        accessToken: "org-a-secret-token",
        refreshToken: "org-a-secret-refresh",
      });

      const tokens = await getSalesforceTokens(pool, orgB.id, integration.id);

      expect(tokens).toBeNull();
    });

    it("rejects storing tokens for an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integration = await seedIntegration(pool, orgA.id, {
        sourceSystem: "salesforce",
      });

      await expect(
        storeSalesforceTokens(pool, orgB.id, integration.id, {
          accessToken: randomUUID(),
          refreshToken: randomUUID(),
        }),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
