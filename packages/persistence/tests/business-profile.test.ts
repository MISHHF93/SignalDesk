import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  getOrganizationBusinessProfile,
  updateOrganizationBusinessProfile,
} from "../src/business-profile";
import { QueryFailedError } from "../src/query-error";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedMembership, seedOrganization } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "organization business profile (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("seeds sensible defaults for a brand-new organization", async () => {
      const org = await seedOrganization(pool);

      const profile = await getOrganizationBusinessProfile(pool, org.id);

      expect(profile).toEqual({
        timezone: "UTC",
        defaultExpectedResponseHours: 24,
        highValueThresholdCents: 1_000_000,
        workingDaysBitmask: 0b0111110, // Mon-Fri
        industry: "unspecified",
      });
    });

    it("updates only the fields provided and records a real audit event", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const updated = await updateOrganizationBusinessProfile(
        pool,
        organizationId,
        userId,
        { timezone: "America/Toronto", highValueThresholdCents: 2_000_000 },
      );

      expect(updated).toEqual({
        timezone: "America/Toronto",
        defaultExpectedResponseHours: 24,
        highValueThresholdCents: 2_000_000,
        workingDaysBitmask: 0b0111110,
        industry: "unspecified",
      });

      const auditRow = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select event_type, outcome from audit_events where subject_id = $1 and event_type = 'organization.business_profile_updated'",
            [organizationId],
          );
          return result.rows[0];
        },
      );

      expect(auditRow).toEqual({
        event_type: "organization.business_profile_updated",
        outcome: "succeeded",
      });
    });

    it("rolls back the profile change too when the audit write fails, rather than leaving an unaudited change committed", async () => {
      const org = await seedOrganization(pool);
      const before = await getOrganizationBusinessProfile(pool, org.id);

      // No real membership exists for this user id in this org, so the
      // audit insert's `resolveMembershipId` throws — proving the update
      // above it in the same transaction is rolled back too, not left
      // committed with a missing audit trail.
      await expect(
        updateOrganizationBusinessProfile(
          pool,
          org.id,
          "00000000-0000-0000-0000-000000000000",
          { timezone: "America/Toronto" },
        ),
      ).rejects.toThrow(/No membership found/);

      const after = await getOrganizationBusinessProfile(pool, org.id);

      expect(after).toEqual(before);
    });

    it("updates the working-days bitmask (e.g. a 7-day-a-week business)", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const updated = await updateOrganizationBusinessProfile(
        pool,
        organizationId,
        userId,
        { workingDaysBitmask: 0b1111111 },
      );

      expect(updated.workingDaysBitmask).toBe(0b1111111);
    });

    it("updates the industry", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const updated = await updateOrganizationBusinessProfile(
        pool,
        organizationId,
        userId,
        { industry: "professional_services" },
      );

      expect(updated.industry).toBe("professional_services");
    });

    it("rejects an unrecognized industry via the database check constraint", async () => {
      const org = await seedOrganization(pool);
      let thrown: unknown;

      try {
        await withTenantContext(pool, org.id, async (client) => {
          await client.query(
            "update organizations set industry = 'not-a-real-industry' where id = $1",
            [org.id],
          );
        });
      } catch (error) {
        thrown = error;
      }

      // withTenantContext wraps a real schema-level constraint violation
      // (query-error.ts) rather than let the constraint name reach a
      // client-visible message — the real detail is still checkable via
      // rawDetail, server-side only.
      expect(thrown).toBeInstanceOf(QueryFailedError);
      expect((thrown as QueryFailedError).rawDetail).toContain(
        "organizations_industry_allowed",
      );
    });

    it("rejects an out-of-range working-days bitmask via the database check constraint", async () => {
      const org = await seedOrganization(pool);
      let thrown: unknown;

      try {
        await withTenantContext(pool, org.id, async (client) => {
          await client.query(
            "update organizations set working_days_bitmask = 128 where id = $1",
            [org.id],
          );
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(QueryFailedError);
      expect((thrown as QueryFailedError).rawDetail).toContain(
        "organizations_working_days_bitmask_range",
      );
    });

    it("rejects a critical-value threshold below zero via the database check constraint", async () => {
      const org = await seedOrganization(pool);
      let thrown: unknown;

      try {
        await withTenantContext(pool, org.id, async (client) => {
          await client.query(
            "update organizations set high_value_threshold_cents = -1 where id = $1",
            [org.id],
          );
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(QueryFailedError);
      expect((thrown as QueryFailedError).rawDetail).toContain(
        "organizations_threshold_nonnegative",
      );
    });

    it("cannot see another organization's business profile", async () => {
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
