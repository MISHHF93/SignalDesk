import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  deleteAIProviderConnection,
  getAIProviderApiKey,
  getAIProviderConnectionStatus,
  upsertAIProviderConnection,
} from "../src/ai-provider-connections";
import { getTestPool, seedOrganization } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "ai provider connections (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("reports not connected before any key is saved", async () => {
      const org = await seedOrganization(pool);

      const status = await getAIProviderConnectionStatus(
        pool,
        org.id,
        "anthropic",
      );

      expect(status).toEqual({ connected: false, updatedAt: null });
    });

    it("saves a real key and reports connected, without ever returning the key itself", async () => {
      const org = await seedOrganization(pool);

      await upsertAIProviderConnection(
        pool,
        org.id,
        "anthropic",
        "sk-ant-test-key-aaa",
      );

      const status = await getAIProviderConnectionStatus(
        pool,
        org.id,
        "anthropic",
      );

      expect(status.connected).toBe(true);
      expect(status.updatedAt).not.toBeNull();
      expect(Object.keys(status)).toEqual(["connected", "updatedAt"]);
    });

    it("resolves the real saved key via getAIProviderApiKey", async () => {
      const org = await seedOrganization(pool);

      await upsertAIProviderConnection(
        pool,
        org.id,
        "anthropic",
        "sk-ant-test-key-bbb",
      );

      const key = await getAIProviderApiKey(pool, org.id, "anthropic");

      expect(key).toBe("sk-ant-test-key-bbb");
    });

    it("replaces the real key on a second save rather than duplicating the connection", async () => {
      const org = await seedOrganization(pool);

      await upsertAIProviderConnection(
        pool,
        org.id,
        "anthropic",
        "sk-ant-original-key",
      );
      await upsertAIProviderConnection(
        pool,
        org.id,
        "anthropic",
        "sk-ant-replaced-key",
      );

      const key = await getAIProviderApiKey(pool, org.id, "anthropic");

      expect(key).toBe("sk-ant-replaced-key");
    });

    it("returns null for a provider that was never connected", async () => {
      const org = await seedOrganization(pool);

      const key = await getAIProviderApiKey(pool, org.id, "anthropic");

      expect(key).toBeNull();
    });

    it("real disconnect removes the key and the status reverts to not-connected", async () => {
      const org = await seedOrganization(pool);

      await upsertAIProviderConnection(
        pool,
        org.id,
        "anthropic",
        "sk-ant-key-to-remove",
      );
      await deleteAIProviderConnection(pool, org.id, "anthropic");

      const status = await getAIProviderConnectionStatus(
        pool,
        org.id,
        "anthropic",
      );
      const key = await getAIProviderApiKey(pool, org.id, "anthropic");

      expect(status).toEqual({ connected: false, updatedAt: null });
      expect(key).toBeNull();
    });

    it("disconnecting a provider that was never connected is a real no-op, not an error", async () => {
      const org = await seedOrganization(pool);

      await expect(
        deleteAIProviderConnection(pool, org.id, "anthropic"),
      ).resolves.toBeUndefined();
    });

    it("cannot see another organization's connection status or key", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);

      await upsertAIProviderConnection(
        pool,
        orgA.id,
        "anthropic",
        "sk-ant-org-a-key",
      );

      const statusForB = await getAIProviderConnectionStatus(
        pool,
        orgB.id,
        "anthropic",
      );
      const keyForB = await getAIProviderApiKey(pool, orgB.id, "anthropic");

      expect(statusForB).toEqual({ connected: false, updatedAt: null });
      expect(keyForB).toBeNull();
    });
  },
);
