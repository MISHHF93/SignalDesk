import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createArtifact } from "../src/artifacts";
import type { DatabasePool } from "../src/client";
import { getPlanByKey } from "../src/plans";
import {
  listActiveOrganizationIds,
  listOrganizationsNeedingDailyBrief,
  listStripeLinkedSubscriptions,
} from "../src/scheduled-jobs";
import {
  createOrganizationSubscription,
  updateSubscriptionFromStripe,
} from "../src/subscriptions";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  queryWithoutTenantContext,
  seedMembership,
} from "./support";

/**
 * The one real cross-tenant read in this codebase (migration 0055b) —
 * see that migration's own doc comment for the full design rationale.
 * These tests prove both halves of the safety claim it makes: the
 * function itself really does return real organization ids across
 * tenants (the whole point), and `app_runtime`'s own ordinary,
 * tenant-scoped access is unaffected by the new policy this required.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "listActiveOrganizationIds (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("includes a real, freshly-seeded organization", async () => {
      const { organizationId } = await seedMembership(pool);

      const ids = await listActiveOrganizationIds(pool);

      expect(ids).toContain(organizationId);
    });

    it("excludes a deactivated organization", async () => {
      const { organizationId } = await seedMembership(pool);

      await withTenantContext(pool, organizationId, async (client) => {
        await client.query(
          `update organizations set deactivated_at = now() where id = $1`,
          [organizationId],
        );
      });

      const ids = await listActiveOrganizationIds(pool);

      expect(ids).not.toContain(organizationId);
    });

    it("does not widen app_runtime's own direct, tenant-scoped access to organizations", async () => {
      const { organizationId: orgA } = await seedMembership(pool);
      await seedMembership(pool);

      // No tenant context set at all — the ordinary shape of a query
      // that forgot to scope itself. If the new policy had accidentally
      // been granted to `app_runtime` directly (rather than to the
      // dedicated `scheduled_job_runner` role only the SECURITY DEFINER
      // function runs as), this would leak every organization; the real,
      // pre-existing `organizations_tenant_select` policy should still
      // reduce this to zero rows.
      const result = await queryWithoutTenantContext(
        pool,
        `select id from organizations where id = $1`,
        [orgA],
      );

      expect(result.rows).toHaveLength(0);
    });
  },
);

/**
 * The morning-brief cron's real organization selection (migration
 * 0065b) — replaces the old unordered `listActiveOrganizationIds` +
 * client-side slice. Real bug found by review: with no ordering, capping
 * at `MAX_ORGANIZATIONS_PER_RUN` could permanently exclude whatever
 * organization count exceeded it, since the same arbitrary subset could
 * be returned every run. These tests prove the actual fix: ordering by
 * least-recently-briefed first, and that the cap is enforced server-side.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "listOrganizationsNeedingDailyBrief (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("prioritizes a never-briefed organization ahead of one briefed today", async () => {
      const { organizationId: neverBriefed } = await seedMembership(pool);
      const { organizationId: alreadyBriefed } = await seedMembership(pool);

      await createArtifact(pool, alreadyBriefed, {
        type: "daily_brief",
        title: "Daily Brief",
        content: "Nothing urgent today.",
        structuredData: {},
        sourceFindingIds: [],
      });

      const ids = await listOrganizationsNeedingDailyBrief(pool, 1000);
      const neverBriefedIndex = ids.indexOf(neverBriefed);
      const alreadyBriefedIndex = ids.indexOf(alreadyBriefed);

      expect(neverBriefedIndex).toBeGreaterThanOrEqual(0);
      expect(alreadyBriefedIndex).toBeGreaterThanOrEqual(0);
      expect(neverBriefedIndex).toBeLessThan(alreadyBriefedIndex);
    });

    it("prioritizes an organization briefed longer ago over one briefed more recently", async () => {
      const { organizationId: briefedLongAgo } = await seedMembership(pool);
      const { organizationId: briefedRecently } = await seedMembership(pool);

      await createArtifact(pool, briefedLongAgo, {
        type: "daily_brief",
        title: "Daily Brief",
        content: "Nothing urgent today.",
        structuredData: {},
        sourceFindingIds: [],
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createArtifact(pool, briefedRecently, {
        type: "daily_brief",
        title: "Daily Brief",
        content: "Nothing urgent today.",
        structuredData: {},
        sourceFindingIds: [],
      });

      const ids = await listOrganizationsNeedingDailyBrief(pool, 1000);

      expect(ids.indexOf(briefedLongAgo)).toBeLessThan(
        ids.indexOf(briefedRecently),
      );
    });

    it("respects the max cap", async () => {
      await seedMembership(pool);
      await seedMembership(pool);

      const ids = await listOrganizationsNeedingDailyBrief(pool, 1);

      expect(ids).toHaveLength(1);
    });

    it("excludes a deactivated organization", async () => {
      const { organizationId } = await seedMembership(pool);

      await withTenantContext(pool, organizationId, async (client) => {
        await client.query(
          `update organizations set deactivated_at = now() where id = $1`,
          [organizationId],
        );
      });

      const ids = await listOrganizationsNeedingDailyBrief(pool, 1000);

      expect(ids).not.toContain(organizationId);
    });
  },
);

/**
 * The billing reconciliation sweep's own cross-tenant read (migration
 * 0056) — same design as `listActiveOrganizationIds` above, so these
 * tests prove the same two-sided safety claim: the function really does
 * return real Stripe-linked subscriptions across tenants, and
 * `app_runtime`'s own ordinary tenant-scoped access is unaffected.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "listStripeLinkedSubscriptions (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("includes a freshly-seeded organization's Stripe-linked subscription", async () => {
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");
      const stripeSubscriptionId = `sub_test_${organizationId}`;

      await createOrganizationSubscription(pool, organizationId, {
        planId: business?.id as string,
        planPriceId: null,
        status: "active",
        stripeCustomerId: `cus_test_${organizationId}`,
        stripeSubscriptionId,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const linked = await listStripeLinkedSubscriptions(pool);
      const found = linked.find((row) => row.organizationId === organizationId);

      expect(found).toBeDefined();
      expect(found?.stripeSubscriptionId).toBe(stripeSubscriptionId);
      expect(found?.status).toBe("active");
    });

    it("excludes an organization that has never had a Stripe subscription attached", async () => {
      const { organizationId } = await seedMembership(pool);

      const linked = await listStripeLinkedSubscriptions(pool);

      expect(
        linked.find((row) => row.organizationId === organizationId),
      ).toBeUndefined();
    });

    // Real bug found by review: with no ordering, capping at
    // MAX_SUBSCRIPTIONS_PER_RUN could permanently exclude whatever
    // subscription count exceeded it. Ordering by updated_at ascending
    // means a subscription just corrected (a real write, which always
    // bumps updated_at) moves toward the back, making room for others —
    // and one left completely untouched (already in sync) stays at the
    // front, always inside the cap.
    it("orders by updated_at ascending, so a just-corrected subscription sorts after an untouched one", async () => {
      const { organizationId: untouched } = await seedMembership(pool);
      const { organizationId: justCorrected } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");

      await createOrganizationSubscription(pool, untouched, {
        planId: business?.id as string,
        planPriceId: null,
        status: "active",
        stripeCustomerId: `cus_test_${untouched}`,
        stripeSubscriptionId: `sub_test_${untouched}`,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });
      await createOrganizationSubscription(pool, justCorrected, {
        planId: business?.id as string,
        planPriceId: null,
        status: "active",
        stripeCustomerId: `cus_test_${justCorrected}`,
        stripeSubscriptionId: `sub_test_${justCorrected}`,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      // A real correction — the same write the reconciliation sweep
      // itself makes when it finds drift — bumps updated_at.
      await updateSubscriptionFromStripe(
        pool,
        justCorrected,
        `sub_test_${justCorrected}`,
        { status: "past_due" },
      );

      const linked = await listStripeLinkedSubscriptions(pool);
      const untouchedIndex = linked.findIndex(
        (row) => row.organizationId === untouched,
      );
      const justCorrectedIndex = linked.findIndex(
        (row) => row.organizationId === justCorrected,
      );

      expect(untouchedIndex).toBeGreaterThanOrEqual(0);
      expect(justCorrectedIndex).toBeGreaterThanOrEqual(0);
      expect(untouchedIndex).toBeLessThan(justCorrectedIndex);
    });

    it("does not widen app_runtime's own direct, tenant-scoped access to organization_subscriptions", async () => {
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");

      await createOrganizationSubscription(pool, organizationId, {
        planId: business?.id as string,
        planPriceId: null,
        status: "active",
        stripeCustomerId: `cus_test_${organizationId}`,
        stripeSubscriptionId: `sub_test_${organizationId}`,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      // No tenant context set — if the new policy had accidentally been
      // granted to `app_runtime` directly (rather than to the dedicated
      // `scheduled_job_runner` role only the SECURITY DEFINER function
      // runs as), this would leak every organization's subscription; the
      // real, pre-existing `organization_subscriptions_tenant_isolation`
      // policy should still reduce this to zero rows.
      const result = await queryWithoutTenantContext(
        pool,
        `select id from organization_subscriptions where organization_id = $1`,
        [organizationId],
      );

      expect(result.rows).toHaveLength(0);
    });
  },
);
