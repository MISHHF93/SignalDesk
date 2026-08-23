import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectQuickBooksIntegration,
  findOrCreateQuickBooksIntegration,
  findOrganizationAndIntegrationIdByQuickBooksRealmId,
  getQuickBooksIntegrationStatus,
} from "../src/quickbooks-integration";
import {
  getQuickBooksTokens,
  storeQuickBooksTokens,
} from "../src/quickbooks-tokens";
import { getTestPool, seedOrganization } from "./support";

// Mirrors hubspot-integration.test.ts's coverage — same atomic-upsert
// pattern, same disconnect mechanism (0019's provider-neutral
// disconnect_integration), keyed by realmId instead of hub id.
describe.skipIf(!process.env.DATABASE_URL)(
  "quickbooks integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new company", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000001",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBeNull();
    });

    it("reuses the same row for the same realm id rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000002",
      );
      const second = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000002",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different realm id", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000003",
      );
      const second = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000004",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("deletes the real Vault secret and marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000005",
      );

      await storeQuickBooksTokens(pool, org.id, integration.id, {
        accessToken: "at-1",
        refreshToken: "rt-1",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      await disconnectQuickBooksIntegration(pool, org.id, integration.id);

      const tokens = await getQuickBooksTokens(pool, org.id, integration.id);
      expect(tokens).toBeNull();

      const status = await getQuickBooksIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000006",
      );

      await disconnectQuickBooksIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000006",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("reports the active company, not the most recently created (but now disconnected) one", async () => {
      const org = await seedOrganization(pool);

      const companyA = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000007",
      );
      await disconnectQuickBooksIntegration(pool, org.id, companyA.id);

      const companyB = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000008",
      );
      await disconnectQuickBooksIntegration(pool, org.id, companyB.id);

      const reconnectedA = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        "9130350000000007",
      );

      const status = await getQuickBooksIntegrationStatus(pool, org.id);

      expect(status?.id).toBe(reconnectedA.id);
      expect(status?.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateQuickBooksIntegration(
        pool,
        orgB.id,
        "9130350000000009",
      );

      await expect(
        disconnectQuickBooksIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });

    // The webhook handler resolves realmId -> organization/integration with
    // no tenant context set yet (see the SECURITY DEFINER function this
    // wraps, migration 0036) — the whole point of this call is bootstrapping
    // that tenant context, so it must work called directly with no
    // withTenantContext wrapper, unlike every other function in this file.
    it("resolves the organization and integration for a real active realm", async () => {
      // A unique realm id per run, not a fixed literal: this resolver
      // deliberately looks up by realmId alone with no org scope (that's
      // its whole job — bootstrapping tenant context for the
      // unauthenticated webhook has no org to scope by yet), so a fixed
      // literal would collide with the same test's own leftover row from
      // a previous run against this persistent live database and make the
      // lookup non-deterministic.
      const realmId = `realm-${randomUUID()}`;
      const org = await seedOrganization(pool);
      const integration = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        realmId,
      );

      const lookup = await findOrganizationAndIntegrationIdByQuickBooksRealmId(
        pool,
        realmId,
      );

      expect(lookup).toEqual({
        organizationId: org.id,
        integrationId: integration.id,
      });
    });

    it("returns null for a realm with no integration at all", async () => {
      const lookup = await findOrganizationAndIntegrationIdByQuickBooksRealmId(
        pool,
        `realm-${randomUUID()}`,
      );

      expect(lookup).toBeNull();
    });

    it("returns null for a realm whose integration was disconnected", async () => {
      const realmId = `realm-${randomUUID()}`;
      const org = await seedOrganization(pool);
      const integration = await findOrCreateQuickBooksIntegration(
        pool,
        org.id,
        realmId,
      );
      await disconnectQuickBooksIntegration(pool, org.id, integration.id);

      const lookup = await findOrganizationAndIntegrationIdByQuickBooksRealmId(
        pool,
        realmId,
      );

      expect(lookup).toBeNull();
    });
  },
);
