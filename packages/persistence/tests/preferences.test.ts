import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  getOrganizationPreferences,
  updateOrganizationPreferences,
} from "../src/preferences";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedMembership, seedOrganization } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "organization preferences (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("seeds the defaults shown on the Preferences card for a brand-new organization", async () => {
      const org = await seedOrganization(pool);

      const preferences = await getOrganizationPreferences(pool, org.id);

      expect(preferences).toEqual({
        morningBriefEnabled: true,
        attentionAlertsEnabled: true,
        weeklyRecapEnabled: false,
      });
    });

    it("updates all three preferences and records a real audit event", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const updated = await updateOrganizationPreferences(
        pool,
        organizationId,
        userId,
        {
          morningBriefEnabled: false,
          attentionAlertsEnabled: true,
          weeklyRecapEnabled: true,
        },
      );

      expect(updated).toEqual({
        morningBriefEnabled: false,
        attentionAlertsEnabled: true,
        weeklyRecapEnabled: true,
      });

      const persisted = await getOrganizationPreferences(pool, organizationId);
      expect(persisted).toEqual(updated);

      const auditRow = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select event_type, outcome from audit_events where subject_id = $1 and event_type = 'organization.preferences_updated'",
            [organizationId],
          );
          return result.rows[0];
        },
      );

      expect(auditRow).toEqual({
        event_type: "organization.preferences_updated",
        outcome: "succeeded",
      });
    });

    it("rolls back the preference change too when the audit write fails, rather than leaving an unaudited change committed", async () => {
      const org = await seedOrganization(pool);
      const before = await getOrganizationPreferences(pool, org.id);

      // No real membership exists for this user id in this org, so the
      // audit insert's `resolveMembershipId` throws — proving the update
      // above it in the same transaction is rolled back too.
      await expect(
        updateOrganizationPreferences(
          pool,
          org.id,
          "00000000-0000-0000-0000-000000000000",
          {
            morningBriefEnabled: false,
            attentionAlertsEnabled: false,
            weeklyRecapEnabled: true,
          },
        ),
      ).rejects.toThrow(/No membership found/);

      const after = await getOrganizationPreferences(pool, org.id);

      expect(after).toEqual(before);
    });

    it("cannot see another organization's preferences", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);

      const rows = await withTenantContext(pool, orgA.id, async (client) => {
        const result = await client.query(
          "select id from organizations where id = $1",
          [orgB.id],
        );
        return result.rows;
      });

      expect(rows).toHaveLength(0);
    });
  },
);
