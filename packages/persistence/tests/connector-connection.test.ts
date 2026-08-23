import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  getConnectorConnection,
  listConnectorConnections,
} from "../src/connector-connection";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "connector connections (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("reads back a real connection with a real vault credential reference", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });

      const connection = await getConnectorConnection(
        pool,
        org.id,
        integration.id,
      );

      expect(connection?.sourceSystem).toBe("hubspot");
      expect(connection?.status).toBe("active");
      expect(connection?.credential).toEqual({ kind: "none" });
    });

    it("returns null for a connection that does not exist", async () => {
      const org = await seedOrganization(pool);

      const connection = await getConnectorConnection(
        pool,
        org.id,
        "11111111-1111-4111-8111-111111111111",
      );

      expect(connection).toBeNull();
    });

    it("lists every active or degraded connection, newest first", async () => {
      const org = await seedOrganization(pool);
      await seedIntegration(pool, org.id, { sourceSystem: "hubspot" });
      const quickbooks = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'degraded' where id = $1",
          [quickbooks.id],
        );
      });

      const connections = await listConnectorConnections(pool, org.id);

      expect(connections.map((c) => c.sourceSystem).sort()).toEqual([
        "hubspot",
        "quickbooks",
      ]);
      const quickbooksConnection = connections.find(
        (c) => c.sourceSystem === "quickbooks",
      );
      expect(quickbooksConnection?.status).toBe("degraded");
    });

    it("excludes a disconnected connection", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "hubspot",
      });
      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [integration.id],
        );
      });

      const connections = await listConnectorConnections(pool, org.id);

      expect(connections).toEqual([]);
    });

    it("does not list another organization's connections", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      await seedIntegration(pool, orgB.id, { sourceSystem: "hubspot" });

      const connections = await listConnectorConnections(pool, orgA.id);

      expect(connections).toEqual([]);
    });
  },
);
