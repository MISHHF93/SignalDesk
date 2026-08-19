import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { getEntitlementUsage } from "../src/subscriptions";
import {
  listSubscriptionAddons,
  removeSubscriptionAddon,
  upsertSubscriptionAddon,
} from "../src/subscription-addons";
import { createOrganizationSubscription } from "../src/subscriptions";
import { getPlanByKey } from "../src/plans";
import { getTestPool, seedMembership } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "organization subscription add-ons (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    async function seedStarterSubscription(organizationId: string) {
      const starter = await getPlanByKey(pool, "starter");
      return createOrganizationSubscription(pool, organizationId, {
        planId: starter?.id as string,
        planPriceId: null,
        status: "active",
        stripeCustomerId: `cus_test_${organizationId}`,
        stripeSubscriptionId: `sub_test_${organizationId}`,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });
    }

    async function extraConnectionsAddonId(): Promise<string> {
      const result = await pool.query<{ id: string }>(
        `select id from public.plan_addons where addon_key = 'extra_5_connections'`,
      );
      return result.rows[0]?.id as string;
    }

    it("attaches an add-on and reflects it in entitlement usage limits", async () => {
      const { organizationId } = await seedMembership(pool);
      const subscription = await seedStarterSubscription(organizationId);
      const addonId = await extraConnectionsAddonId();

      const before = await getEntitlementUsage(pool, organizationId);
      expect(before.activeConnectionsLimit).toBe(5);

      await upsertSubscriptionAddon(
        pool,
        organizationId,
        subscription.id,
        addonId,
        1,
        "si_test_1",
      );

      const after = await getEntitlementUsage(pool, organizationId);
      expect(after.activeConnectionsLimit).toBe(10);

      const addons = await listSubscriptionAddons(pool, organizationId);
      expect(addons).toHaveLength(1);
      expect(addons[0]?.addonKey).toBe("extra_5_connections");
      expect(addons[0]?.quantity).toBe(1);
    });

    it("scales the entitlement grant with quantity", async () => {
      const { organizationId } = await seedMembership(pool);
      const subscription = await seedStarterSubscription(organizationId);
      const addonId = await extraConnectionsAddonId();

      await upsertSubscriptionAddon(
        pool,
        organizationId,
        subscription.id,
        addonId,
        3,
        "si_test_2",
      );

      const usage = await getEntitlementUsage(pool, organizationId);
      // 5 base + (3 * 5) = 20
      expect(usage.activeConnectionsLimit).toBe(20);
    });

    it("updates the quantity in place on a second upsert rather than duplicating the row", async () => {
      const { organizationId } = await seedMembership(pool);
      const subscription = await seedStarterSubscription(organizationId);
      const addonId = await extraConnectionsAddonId();

      await upsertSubscriptionAddon(
        pool,
        organizationId,
        subscription.id,
        addonId,
        1,
        "si_test_3",
      );
      await upsertSubscriptionAddon(
        pool,
        organizationId,
        subscription.id,
        addonId,
        2,
        "si_test_3_updated",
      );

      const addons = await listSubscriptionAddons(pool, organizationId);
      expect(addons).toHaveLength(1);
      expect(addons[0]?.quantity).toBe(2);
      expect(addons[0]?.stripeSubscriptionItemId).toBe("si_test_3_updated");
    });

    it("removes an add-on and its entitlement grant with it", async () => {
      const { organizationId } = await seedMembership(pool);
      const subscription = await seedStarterSubscription(organizationId);
      const addonId = await extraConnectionsAddonId();

      await upsertSubscriptionAddon(
        pool,
        organizationId,
        subscription.id,
        addonId,
        1,
        "si_test_4",
      );
      await removeSubscriptionAddon(
        pool,
        organizationId,
        subscription.id,
        addonId,
      );

      const addons = await listSubscriptionAddons(pool, organizationId);
      expect(addons).toHaveLength(0);

      const usage = await getEntitlementUsage(pool, organizationId);
      expect(usage.activeConnectionsLimit).toBe(5);
    });

    it("cannot see another organization's add-ons", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);
      const subscriptionB = await seedStarterSubscription(orgB.organizationId);
      const addonId = await extraConnectionsAddonId();

      await upsertSubscriptionAddon(
        pool,
        orgB.organizationId,
        subscriptionB.id,
        addonId,
        1,
        "si_test_5",
      );

      const addonsFromOrgA = await listSubscriptionAddons(
        pool,
        orgA.organizationId,
      );

      expect(addonsFromOrgA).toHaveLength(0);
    });
  },
);
