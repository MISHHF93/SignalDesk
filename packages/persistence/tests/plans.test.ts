import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  getCurrentStandardPrice,
  getEnabledPlanAddons,
  getPlanByKey,
  getPlanCatalog,
  getPlanPriceById,
  getRedeemablePromoPrice,
  recordPromoRedemption,
} from "../src/plans";
import { getTestPool } from "./support";

// Exercises the real launch pricing seeded by drizzle/0023 against the
// live database — not synthetic fixtures, since the catalog itself is
// meant to be read exactly as shipped.
describe.skipIf(!process.env.DATABASE_URL)(
  "plan catalog (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("lists all four launch plans in tier order with real prices and entitlements", async () => {
      const catalog = await getPlanCatalog(pool);
      const planKeys = catalog.map((entry) => entry.planKey);

      expect(planKeys).toEqual(["starter", "business", "scale", "enterprise"]);

      const starter = catalog.find((entry) => entry.planKey === "starter");
      expect(starter?.monthlyPriceCents).toBe(4900);
      expect(starter?.annualPriceCents).toBe(49000);
      expect(starter?.includedUsers).toBe(5);
      expect(starter?.includedActiveConnections).toBe(5);
      expect(starter?.isRecommended).toBe(false);

      const business = catalog.find((entry) => entry.planKey === "business");
      expect(business?.monthlyPriceCents).toBe(12900);
      expect(business?.annualPriceCents).toBe(129000);
      expect(business?.includedUsers).toBe(15);
      expect(business?.includedActiveConnections).toBe(15);
      expect(business?.isRecommended).toBe(true);
      expect(business?.capabilityFlags.actionPreparation).toBe(true);
      expect(business?.capabilityFlags.approvals).toBe(true);
      expect(business?.capabilityFlags.delegatedAutomation).toBe(false);

      const scale = catalog.find((entry) => entry.planKey === "scale");
      expect(scale?.monthlyPriceCents).toBe(29900);
      expect(scale?.includedUsers).toBe(40);
      expect(scale?.capabilityFlags.delegatedAutomation).toBe(true);
      expect(scale?.capabilityFlags.advancedPolicies).toBe(true);

      const enterprise = catalog.find(
        (entry) => entry.planKey === "enterprise",
      );
      expect(enterprise?.isCustomPricing).toBe(true);
      expect(enterprise?.supportsSelfServeCheckout).toBe(false);
      expect(enterprise?.monthlyPriceCents).toBeNull();
      expect(enterprise?.includedUsers).toBeNull();
      expect(enterprise?.capabilityFlags.enterpriseIdentity).toBe(true);
    });

    it("resolves a plan by key", async () => {
      const business = await getPlanByKey(pool, "business");

      expect(business?.name).toBe("Business");
      expect(business?.supportsSelfServeCheckout).toBe(true);
    });

    it("returns null for an unknown plan key", async () => {
      const unknown = await getPlanByKey(pool, "not-a-real-plan");

      expect(unknown).toBeNull();
    });

    it("finds the current standard monthly and annual price for a plan", async () => {
      const monthly = await getCurrentStandardPrice(pool, "scale", "month");
      const annual = await getCurrentStandardPrice(pool, "scale", "year");

      expect(monthly?.amountCents).toBe(29900);
      expect(monthly?.priceKind).toBe("standard");
      expect(annual?.amountCents).toBe(299000);
    });

    it("looks up a price row by its own id, with the plan key joined in", async () => {
      const monthly = await getCurrentStandardPrice(pool, "scale", "month");

      const byId = await getPlanPriceById(pool, monthly?.id as string);

      expect(byId?.planKey).toBe("scale");
      expect(byId?.billingInterval).toBe("month");
      expect(byId?.amountCents).toBe(29900);
    });

    it("returns null for an unknown price id", async () => {
      const price = await getPlanPriceById(
        pool,
        "00000000-0000-4000-8000-000000000000",
      );

      expect(price).toBeNull();
    });

    it("returns no price for enterprise (custom pricing, no plan_prices row)", async () => {
      const monthly = await getCurrentStandardPrice(
        pool,
        "enterprise",
        "month",
      );

      expect(monthly).toBeNull();
    });

    it("finds the founding-business-79 promo price while it's still redeemable", async () => {
      const promo = await getRedeemablePromoPrice(pool, "founding-business-79");

      expect(promo?.amountCents).toBe(7900);
      expect(promo?.planKey).toBe("business");
      expect(promo?.priceKind).toBe("promotional");
    });

    it("returns null for a promo key that doesn't exist", async () => {
      const promo = await getRedeemablePromoPrice(pool, "not-a-real-promo");

      expect(promo).toBeNull();
    });

    it("returns false rather than throwing for a redemption on a nonexistent price", async () => {
      // Catalog tables are intentionally read-only for app_runtime except
      // the one column-level grant real checkout traffic needs
      // (promo_redemptions_count, see drizzle/0024) — app_runtime has no
      // INSERT on plan_prices, so this test can't seed a throwaway capped
      // promo row the way most other tests seed their own fixtures. The
      // cap-exceeded branch (the UPDATE's own WHERE re-check) was verified
      // directly against the database during development instead; this
      // covers the no-such-row path, which needs no elevated privilege.
      const redeemed = await recordPromoRedemption(
        pool,
        "00000000-0000-0000-0000-000000000000",
      );

      expect(redeemed).toBe(false);
    });

    it("lists the two enabled capacity add-ons at $20/month each", async () => {
      const addons = await getEnabledPlanAddons(pool);
      const addonKeys = addons.map((addon) => addon.addonKey);

      expect(addonKeys).toContain("extra_5_connections");
      expect(addonKeys).toContain("extra_10_users");

      const extraConnections = addons.find(
        (addon) => addon.addonKey === "extra_5_connections",
      );
      expect(extraConnections?.amountCents).toBe(2000);
      expect(extraConnections?.grantsActiveConnections).toBe(5);
      expect(extraConnections?.grantsUsers).toBe(0);
    });

    // `getEnabledPlanAddons`'s `where is_enabled = true` filter — proving an
    // add-on actually disappears once disabled — was verified directly
    // against the database during development rather than as a live test
    // here: plan_addons.is_enabled is deliberately not app_runtime-writable
    // (disabling an add-on is a migration/operator action, matching "keep
    // them configuration-driven," not something checkout traffic does), so
    // a test can't flip it back and forth without the same elevated access
    // the app itself intentionally lacks.
  },
);
