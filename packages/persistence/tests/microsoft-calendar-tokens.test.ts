import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  getMicrosoftCalendarTokens,
  storeMicrosoftCalendarTokens,
} from "../src/microsoft-calendar-tokens";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

// Mirrors microsoft-outlook-tokens.test.ts exactly.
describe.skipIf(!process.env.DATABASE_URL)(
  "microsoft calendar tokens (live database)",
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
        sourceSystem: "microsoft-calendar",
      });
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storeMicrosoftCalendarTokens(pool, org.id, integration.id, {
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        expiresAt,
      });

      const tokens = await getMicrosoftCalendarTokens(
        pool,
        org.id,
        integration.id,
      );

      expect(tokens).not.toBeNull();
      expect(tokens?.accessToken).toBe("test-access-token");
      expect(tokens?.refreshToken).toBe("test-refresh-token");
      expect(tokens?.expiresAt.getTime()).toBe(expiresAt.getTime());
    });

    it("rotates tokens in place on a second store", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "microsoft-calendar",
      });

      await storeMicrosoftCalendarTokens(pool, org.id, integration.id, {
        accessToken: "first-token",
        refreshToken: "first-refresh",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      await storeMicrosoftCalendarTokens(pool, org.id, integration.id, {
        accessToken: "rotated-token",
        refreshToken: "rotated-refresh",
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });

      const tokens = await getMicrosoftCalendarTokens(
        pool,
        org.id,
        integration.id,
      );

      expect(tokens?.accessToken).toBe("rotated-token");
      expect(tokens?.refreshToken).toBe("rotated-refresh");
    });

    it("returns null for an integration with no stored tokens yet", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "microsoft-calendar",
      });

      const tokens = await getMicrosoftCalendarTokens(
        pool,
        org.id,
        integration.id,
      );

      expect(tokens).toBeNull();
    });

    it("never leaks tokens across tenants", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integration = await seedIntegration(pool, orgA.id, {
        sourceSystem: "microsoft-calendar",
      });

      await storeMicrosoftCalendarTokens(pool, orgA.id, integration.id, {
        accessToken: "org-a-secret-token",
        refreshToken: "org-a-secret-refresh",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const tokens = await getMicrosoftCalendarTokens(
        pool,
        orgB.id,
        integration.id,
      );

      expect(tokens).toBeNull();
    });

    it("rejects storing tokens for an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integration = await seedIntegration(pool, orgA.id, {
        sourceSystem: "microsoft-calendar",
      });

      await expect(
        storeMicrosoftCalendarTokens(pool, orgB.id, integration.id, {
          accessToken: randomUUID(),
          refreshToken: randomUUID(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });
  },
);
