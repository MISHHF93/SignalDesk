import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  getConnectorSettings,
  updateConnectorSettings,
} from "../src/connector-settings";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedIntegration, seedMembership } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "connector settings (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("defaults to an empty enabled-capability set", async () => {
      const { organizationId } = await seedMembership(pool);
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "hubspot",
      });

      const settings = await getConnectorSettings(
        pool,
        organizationId,
        integration.id,
      );

      expect(settings.enabledCapabilityIds).toEqual([]);
    });

    it("persists an update and writes a real audit event", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "hubspot",
      });

      const updated = await updateConnectorSettings(
        pool,
        organizationId,
        userId,
        integration.id,
        ["crm-record-insights"],
      );

      expect(updated.enabledCapabilityIds).toEqual(["crm-record-insights"]);

      const fetched = await getConnectorSettings(
        pool,
        organizationId,
        integration.id,
      );
      expect(fetched.enabledCapabilityIds).toEqual(["crm-record-insights"]);

      const auditRow = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select event_type, outcome, subject_id from audit_events where subject_id = $1 order by occurred_at desc limit 1",
            [integration.id],
          );
          return result.rows[0];
        },
      );

      expect(auditRow.event_type).toBe("connector.settings_updated");
      expect(auditRow.outcome).toBe("succeeded");
    });

    it("throws updating settings for an integration that does not exist", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      await expect(
        updateConnectorSettings(
          pool,
          organizationId,
          userId,
          "11111111-1111-4111-8111-111111111111",
          [],
        ),
      ).rejects.toThrow(/not found/i);
    });
  },
);
