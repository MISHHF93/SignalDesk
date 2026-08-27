import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { getPlanByKey } from "../src/plans";
import {
  canAddActiveConnection,
  createOrganizationSubscription,
  findOrganizationIdByStripeCustomerId,
  findOrganizationIdByStripeSubscriptionId,
  getEntitlementUsage,
  getOrganizationSubscription,
  resurrectOrganizationSubscription,
  updateSubscriptionFromStripe,
} from "../src/subscriptions";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedIntegration, seedMembership } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "organization subscriptions (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("returns null before any subscription exists", async () => {
      const { organizationId } = await seedMembership(pool);

      const subscription = await getOrganizationSubscription(
        pool,
        organizationId,
      );

      expect(subscription).toBeNull();
    });

    it("creates a real trialing subscription and reads it back with the plan key joined in", async () => {
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const created = await createOrganizationSubscription(
        pool,
        organizationId,
        {
          planId: business?.id as string,
          planPriceId: null,
          status: "trialing",
          stripeCustomerId: `cus_test_${organizationId}`,
          stripeSubscriptionId: `sub_test_${organizationId}`,
          stripeMode: "test",
          trialEndsAt,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      );

      expect(created.planKey).toBe("business");
      expect(created.status).toBe("trialing");
      expect(created.trialEndsAt?.getTime()).toBe(trialEndsAt.getTime());

      const fetched = await getOrganizationSubscription(pool, organizationId);
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.stripeSubscriptionId).toBe(`sub_test_${organizationId}`);
    });

    it("updates subscription state from a webhook-shaped call, keyed by stripe_subscription_id", async () => {
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");
      const stripeSubscriptionId = `sub_test_${organizationId}`;

      await createOrganizationSubscription(pool, organizationId, {
        planId: business?.id as string,
        planPriceId: null,
        status: "trialing",
        stripeCustomerId: `cus_test_${organizationId}`,
        stripeSubscriptionId,
        stripeMode: "test",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      const periodStart = new Date();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const updated = await updateSubscriptionFromStripe(
        pool,
        organizationId,
        stripeSubscriptionId,
        {
          status: "active",
          trialEndsAt: null,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      );

      expect(updated?.status).toBe("active");
      expect(updated?.trialEndsAt).toBeNull();
      expect(updated?.currentPeriodEnd?.getTime()).toBe(periodEnd.getTime());
    });

    it("marks cancel_at_period_end without clearing other fields", async () => {
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");
      const stripeSubscriptionId = `sub_test_${organizationId}`;

      const created = await createOrganizationSubscription(
        pool,
        organizationId,
        {
          planId: business?.id as string,
          planPriceId: null,
          status: "active",
          stripeCustomerId: `cus_test_${organizationId}`,
          stripeSubscriptionId,
          stripeMode: "test",
          trialEndsAt: null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      );

      const updated = await updateSubscriptionFromStripe(
        pool,
        organizationId,
        stripeSubscriptionId,
        { status: "active", cancelAtPeriodEnd: true },
      );

      expect(updated?.cancelAtPeriodEnd).toBe(true);
      expect(updated?.currentPeriodEnd?.getTime()).toBe(
        created.currentPeriodEnd?.getTime(),
      );
    });

    it("regression: rejects a write whose stripeEventCreatedAt is older than the last one that actually applied", async () => {
      // Real bug found by review: Stripe does not guarantee webhook
      // delivery order. Without this guard, a delayed retry of an older
      // event arriving after a newer one already applied would silently
      // overwrite the correct, newer state with the stale one.
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");
      const stripeSubscriptionId = `sub_test_${organizationId}`;
      const now = new Date();
      const anHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      await createOrganizationSubscription(pool, organizationId, {
        planId: business?.id as string,
        planPriceId: null,
        status: "trialing",
        stripeCustomerId: `cus_test_${organizationId}`,
        stripeSubscriptionId,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      const newer = await updateSubscriptionFromStripe(
        pool,
        organizationId,
        stripeSubscriptionId,
        { status: "active", stripeEventCreatedAt: now },
      );
      expect(newer?.status).toBe("active");

      const stale = await updateSubscriptionFromStripe(
        pool,
        organizationId,
        stripeSubscriptionId,
        { status: "past_due", stripeEventCreatedAt: anHourAgo },
      );
      expect(stale).toBeNull();

      const fetched = await getOrganizationSubscription(pool, organizationId);
      expect(fetched?.status).toBe("active");
    });

    it("regression: still applies a genuinely newer stripeEventCreatedAt write after an older one", async () => {
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");
      const stripeSubscriptionId = `sub_test_${organizationId}`;
      const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const now = new Date();

      await createOrganizationSubscription(pool, organizationId, {
        planId: business?.id as string,
        planPriceId: null,
        status: "trialing",
        stripeCustomerId: `cus_test_${organizationId}`,
        stripeSubscriptionId,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      await updateSubscriptionFromStripe(
        pool,
        organizationId,
        stripeSubscriptionId,
        {
          status: "active",
          stripeEventCreatedAt: anHourAgo,
        },
      );

      const updated = await updateSubscriptionFromStripe(
        pool,
        organizationId,
        stripeSubscriptionId,
        { status: "past_due", stripeEventCreatedAt: now },
      );

      expect(updated?.status).toBe("past_due");
    });

    it("applies unconditionally, with no ordering guard, when stripeEventCreatedAt is omitted", async () => {
      // Direct, synchronous callers (cancel/resume/change-plan Server
      // Actions, the reconciliation cron) have no event to compare and
      // must keep their existing always-write behavior.
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");
      const stripeSubscriptionId = `sub_test_${organizationId}`;

      await createOrganizationSubscription(pool, organizationId, {
        planId: business?.id as string,
        planPriceId: null,
        status: "trialing",
        stripeCustomerId: `cus_test_${organizationId}`,
        stripeSubscriptionId,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      await updateSubscriptionFromStripe(
        pool,
        organizationId,
        stripeSubscriptionId,
        {
          status: "active",
          stripeEventCreatedAt: new Date(),
        },
      );

      // No stripeEventCreatedAt at all here — must not be blocked by the
      // synced timestamp the previous call just recorded.
      const updated = await updateSubscriptionFromStripe(
        pool,
        organizationId,
        stripeSubscriptionId,
        { status: "past_due" },
      );

      expect(updated?.status).toBe("past_due");
    });

    it("resurrects a canceled subscription into a brand new one, in place", async () => {
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");
      const starter = await getPlanByKey(pool, "starter");
      const oldStripeSubscriptionId = `sub_test_old_${organizationId}`;

      const original = await createOrganizationSubscription(
        pool,
        organizationId,
        {
          planId: business?.id as string,
          planPriceId: null,
          status: "active",
          stripeCustomerId: `cus_test_old_${organizationId}`,
          stripeSubscriptionId: oldStripeSubscriptionId,
          stripeMode: "test",
          trialEndsAt: null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      );

      await updateSubscriptionFromStripe(
        pool,
        organizationId,
        oldStripeSubscriptionId,
        {
          status: "canceled",
          canceledAt: new Date(),
          cancelAtPeriodEnd: false,
        },
      );

      const newStripeSubscriptionId = `sub_test_new_${organizationId}`;
      const resurrected = await resurrectOrganizationSubscription(
        pool,
        organizationId,
        {
          planId: starter?.id as string,
          planPriceId: null,
          status: "incomplete",
          stripeCustomerId: `cus_test_new_${organizationId}`,
          stripeSubscriptionId: newStripeSubscriptionId,
          stripeMode: "test",
          trialEndsAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      );

      expect(resurrected?.id).toBe(original.id);
      expect(resurrected?.planKey).toBe("starter");
      expect(resurrected?.status).toBe("incomplete");
      expect(resurrected?.stripeSubscriptionId).toBe(newStripeSubscriptionId);
      expect(resurrected?.cancelAtPeriodEnd).toBe(false);
      expect(resurrected?.canceledAt).toBeNull();

      const fetched = await getOrganizationSubscription(pool, organizationId);
      expect(fetched?.stripeSubscriptionId).toBe(newStripeSubscriptionId);
    });

    it("refuses to resurrect a subscription that isn't actually canceled or expired", async () => {
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
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const result = await resurrectOrganizationSubscription(
        pool,
        organizationId,
        {
          planId: business?.id as string,
          planPriceId: null,
          status: "incomplete",
          stripeCustomerId: `cus_test_new_${organizationId}`,
          stripeSubscriptionId: `sub_test_new_${organizationId}`,
          stripeMode: "test",
          trialEndsAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      );

      expect(result).toBeNull();
    });

    it("returns null when resurrecting an organization with no subscription at all", async () => {
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");

      const result = await resurrectOrganizationSubscription(
        pool,
        organizationId,
        {
          planId: business?.id as string,
          planPriceId: null,
          status: "incomplete",
          stripeCustomerId: `cus_test_${organizationId}`,
          stripeSubscriptionId: `sub_test_${organizationId}`,
          stripeMode: "test",
          trialEndsAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      );

      expect(result).toBeNull();
    });

    it("resolves an organization id from a stripe_subscription_id or stripe_customer_id", async () => {
      const { organizationId } = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");
      const stripeSubscriptionId = `sub_test_${organizationId}`;
      const stripeCustomerId = `cus_test_${organizationId}`;

      await createOrganizationSubscription(pool, organizationId, {
        planId: business?.id as string,
        planPriceId: null,
        status: "active",
        stripeCustomerId,
        stripeSubscriptionId,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      const bySubscription = await findOrganizationIdByStripeSubscriptionId(
        pool,
        stripeSubscriptionId,
      );
      const byCustomer = await findOrganizationIdByStripeCustomerId(
        pool,
        stripeCustomerId,
      );

      expect(bySubscription).toBe(organizationId);
      expect(byCustomer).toBe(organizationId);
    });

    it("returns null for an unknown stripe id rather than throwing", async () => {
      const result = await findOrganizationIdByStripeSubscriptionId(
        pool,
        "sub_does_not_exist",
      );

      expect(result).toBeNull();
    });

    it("computes real entitlement usage against live memberships and integrations counts", async () => {
      const { organizationId } = await seedMembership(pool);
      const starter = await getPlanByKey(pool, "starter");

      await createOrganizationSubscription(pool, organizationId, {
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

      const beforeConnections = await getEntitlementUsage(pool, organizationId);
      expect(beforeConnections.usersUsed).toBe(1); // the seeded owner
      expect(beforeConnections.usersLimit).toBe(5);
      expect(beforeConnections.activeConnectionsUsed).toBe(0);
      expect(beforeConnections.activeConnectionsLimit).toBe(5);
      expect(beforeConnections.capabilityFlags.actionPreparation).toBe(false);

      await seedIntegration(pool, organizationId, { sourceSystem: "slack" });
      await seedIntegration(pool, organizationId, { sourceSystem: "asana" });

      const afterConnections = await getEntitlementUsage(pool, organizationId);
      expect(afterConnections.activeConnectionsUsed).toBe(2);
    });

    it("still counts a degraded connection against the plan's connection limit", async () => {
      const { organizationId } = await seedMembership(pool);
      const starter = await getPlanByKey(pool, "starter");

      await createOrganizationSubscription(pool, organizationId, {
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

      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "slack",
      });
      await withTenantContext(pool, organizationId, async (client) => {
        await client.query(
          "update integrations set status = 'degraded' where id = $1",
          [integration.id],
        );
      });

      const usage = await getEntitlementUsage(pool, organizationId);
      expect(usage.activeConnectionsUsed).toBe(1);
    });

    it("allows adding a connection under the limit and blocks it once at the limit", async () => {
      const { organizationId } = await seedMembership(pool);
      const starter = await getPlanByKey(pool, "starter");

      await createOrganizationSubscription(pool, organizationId, {
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

      expect(await canAddActiveConnection(pool, organizationId)).toBe(true);

      const sources = ["hubspot", "slack", "stripe", "quickbooks", "gmail"];
      for (const sourceSystem of sources) {
        await seedIntegration(pool, organizationId, { sourceSystem });
      }

      // Starter's real seeded entitlement is exactly 5 active connections.
      expect(await canAddActiveConnection(pool, organizationId)).toBe(false);
    });

    it("grants no entitlement once a subscription is canceled, even though the row still exists", async () => {
      const { organizationId } = await seedMembership(pool);
      const starter = await getPlanByKey(pool, "starter");

      await createOrganizationSubscription(pool, organizationId, {
        planId: starter?.id as string,
        planPriceId: null,
        status: "canceled",
        stripeCustomerId: `cus_test_${organizationId}`,
        stripeSubscriptionId: `sub_test_${organizationId}`,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      const usage = await getEntitlementUsage(pool, organizationId);
      expect(usage.usersLimit).toBe(0);
      expect(usage.activeConnectionsLimit).toBe(0);
      expect(usage.capabilityFlags).toEqual({});
      expect(await canAddActiveConnection(pool, organizationId)).toBe(false);
    });

    it("keeps entitlement usable during past_due (a grace period, not an instant cutoff)", async () => {
      const { organizationId } = await seedMembership(pool);
      const starter = await getPlanByKey(pool, "starter");

      await createOrganizationSubscription(pool, organizationId, {
        planId: starter?.id as string,
        planPriceId: null,
        status: "past_due",
        stripeCustomerId: `cus_test_${organizationId}`,
        stripeSubscriptionId: `sub_test_${organizationId}`,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      expect(await canAddActiveConnection(pool, organizationId)).toBe(true);
    });

    it("never blocks when the plan entitlement is negotiated/unbounded (enterprise)", async () => {
      const { organizationId } = await seedMembership(pool);
      const enterprise = await getPlanByKey(pool, "enterprise");

      await createOrganizationSubscription(pool, organizationId, {
        planId: enterprise?.id as string,
        planPriceId: null,
        status: "active",
        stripeCustomerId: `cus_test_${organizationId}`,
        stripeSubscriptionId: `sub_test_${organizationId}`,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      for (let i = 0; i < 10; i += 1) {
        await seedIntegration(pool, organizationId, {
          sourceSystem: `provider-${i}`,
        });
      }

      const usage = await getEntitlementUsage(pool, organizationId);
      expect(usage.activeConnectionsLimit).toBeNull();
      expect(await canAddActiveConnection(pool, organizationId)).toBe(true);
    });

    it("cannot see another organization's subscription", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);
      const business = await getPlanByKey(pool, "business");

      await createOrganizationSubscription(pool, orgB.organizationId, {
        planId: business?.id as string,
        planPriceId: null,
        status: "active",
        stripeCustomerId: `cus_test_${orgB.organizationId}`,
        stripeSubscriptionId: `sub_test_${orgB.organizationId}`,
        stripeMode: "test",
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      const subscriptionFromOrgA = await getOrganizationSubscription(
        pool,
        orgA.organizationId,
      );

      expect(subscriptionFromOrgA).toBeNull();
    });

    // Real gap found by review: guest sign-in (ADR 0009) never goes
    // through real Stripe checkout, so a guest organization never has a
    // subscription row and would otherwise fall into the exact same
    // zero-entitlement branch a churned real customer gets — blocking a
    // guest from connecting a single integration. organizations.is_guest
    // (migration 0070) is the real, explicit fact that bypasses this.
    it("grants full, unmetered entitlements to a guest organization with no subscription at all", async () => {
      const { organizationId } = await seedMembership(pool);

      await withTenantContext(pool, organizationId, async (client) => {
        await client.query(
          `update organizations set is_guest = true where id = $1`,
          [organizationId],
        );
      });

      const usage = await getEntitlementUsage(pool, organizationId);

      expect(usage.usersLimit).toBeNull();
      expect(usage.activeConnectionsLimit).toBeNull();
      expect(usage.capabilityFlags).toEqual({
        approvals: true,
        advancedPolicies: true,
        customConnectors: true,
        actionPreparation: true,
        enterpriseIdentity: true,
        governanceControls: true,
        delegatedAutomation: true,
      });
      expect(await canAddActiveConnection(pool, organizationId)).toBe(true);
    });

    it("lets a guest organization connect well past what any real plan's connection limit would allow", async () => {
      const { organizationId } = await seedMembership(pool);

      await withTenantContext(pool, organizationId, async (client) => {
        await client.query(
          `update organizations set is_guest = true where id = $1`,
          [organizationId],
        );
      });

      for (let i = 0; i < 20; i += 1) {
        await seedIntegration(pool, organizationId, {
          sourceSystem: `provider-${i}`,
        });
      }

      const usage = await getEntitlementUsage(pool, organizationId);

      expect(usage.activeConnectionsUsed).toBe(20);
      expect(usage.activeConnectionsLimit).toBeNull();
      expect(await canAddActiveConnection(pool, organizationId)).toBe(true);
    });

    it("still reports real usage counts for a guest organization, not zero", async () => {
      const { organizationId } = await seedMembership(pool);

      await withTenantContext(pool, organizationId, async (client) => {
        await client.query(
          `update organizations set is_guest = true where id = $1`,
          [organizationId],
        );
      });
      await seedIntegration(pool, organizationId, { sourceSystem: "hubspot" });

      const usage = await getEntitlementUsage(pool, organizationId);

      expect(usage.usersUsed).toBe(1);
      expect(usage.activeConnectionsUsed).toBe(1);
    });
  },
);
