import type { DatabasePool } from "./client";

/**
 * Real billing catalog reads — plans, prices, entitlements, add-ons.
 * Deliberately NOT tenant-scoped (no `withTenantContext`): this is public
 * pricing-page data, readable by signed-out visitors, the same trust tier
 * as the connector catalog. See drizzle/0022's migration header comment
 * for why these tables have no RLS at all.
 */

export interface PlanCatalogEntry {
  readonly planKey: string;
  readonly name: string;
  readonly tierOrder: number;
  readonly isRecommended: boolean;
  readonly isCustomPricing: boolean;
  readonly supportsSelfServeCheckout: boolean;
  readonly differentiationSummary: string;
  readonly monthlyPriceCents: number | null;
  readonly annualPriceCents: number | null;
  readonly includedUsers: number | null;
  readonly includedActiveConnections: number | null;
  readonly capabilityFlags: Record<string, boolean>;
}

interface PlanCatalogRow {
  readonly plan_key: string;
  readonly name: string;
  readonly tier_order: number;
  readonly is_recommended: boolean;
  readonly is_custom_pricing: boolean;
  readonly supports_self_serve_checkout: boolean;
  readonly differentiation_summary: string;
  readonly monthly_price_cents: number | null;
  readonly annual_price_cents: number | null;
  readonly included_users: number | null;
  readonly included_active_connections: number | null;
  readonly capability_flags: Record<string, boolean>;
}

/**
 * One row per plan, joined against its current standard prices (monthly
 * and annual, if either exists — Enterprise has neither, by design) and
 * current entitlement version. "Current" means the effective_to-is-null
 * row for each plan — the versioning columns exist so a future price or
 * entitlement change is a new row with a real effective_from, not an
 * overwrite, but callers reading "what does this plan cost/include right
 * now" only ever need the current row.
 */
export async function getPlanCatalog(
  pool: DatabasePool,
): Promise<readonly PlanCatalogEntry[]> {
  const result = await pool.query<PlanCatalogRow>(
    `select
       p.plan_key,
       p.name,
       p.tier_order,
       p.is_recommended,
       p.is_custom_pricing,
       p.supports_self_serve_checkout,
       p.differentiation_summary,
       monthly.amount_cents as monthly_price_cents,
       annual.amount_cents as annual_price_cents,
       ent.included_users,
       ent.included_active_connections,
       ent.capability_flags
     from public.plans p
     left join public.plan_prices monthly
       on monthly.plan_id = p.id
       and monthly.billing_interval = 'month'
       and monthly.price_kind = 'standard'
       and monthly.effective_to is null
     left join public.plan_prices annual
       on annual.plan_id = p.id
       and annual.billing_interval = 'year'
       and annual.price_kind = 'standard'
       and annual.effective_to is null
     left join public.plan_entitlements ent
       on ent.plan_id = p.id
       and ent.effective_to is null
     order by p.tier_order asc`,
  );

  return result.rows.map((row) => ({
    planKey: row.plan_key,
    name: row.name,
    tierOrder: row.tier_order,
    isRecommended: row.is_recommended,
    isCustomPricing: row.is_custom_pricing,
    supportsSelfServeCheckout: row.supports_self_serve_checkout,
    differentiationSummary: row.differentiation_summary,
    monthlyPriceCents: row.monthly_price_cents,
    annualPriceCents: row.annual_price_cents,
    includedUsers: row.included_users,
    includedActiveConnections: row.included_active_connections,
    capabilityFlags: row.capability_flags,
  }));
}

export interface PlanPriceRecord {
  readonly id: string;
  readonly planId: string;
  readonly planKey: string;
  readonly billingInterval: "month" | "year";
  readonly amountCents: number | null;
  readonly currency: string;
  readonly stripePriceIdTest: string | null;
  readonly stripePriceIdLive: string | null;
  readonly priceKind: "standard" | "promotional";
  readonly promoKey: string | null;
}

interface PlanPriceDbRow {
  readonly id: string;
  readonly plan_id: string;
  readonly plan_key: string;
  readonly billing_interval: "month" | "year";
  readonly amount_cents: number | null;
  readonly currency: string;
  readonly stripe_price_id_test: string | null;
  readonly stripe_price_id_live: string | null;
  readonly price_kind: "standard" | "promotional";
  readonly promo_key: string | null;
}

function toPriceRecord(row: PlanPriceDbRow): PlanPriceRecord {
  return {
    id: row.id,
    planId: row.plan_id,
    planKey: row.plan_key,
    billingInterval: row.billing_interval,
    amountCents: row.amount_cents,
    currency: row.currency,
    stripePriceIdTest: row.stripe_price_id_test,
    stripePriceIdLive: row.stripe_price_id_live,
    priceKind: row.price_kind,
    promoKey: row.promo_key,
  };
}

/**
 * The current standard (non-promotional) price for a plan at a given
 * billing interval — the row a normal checkout locks a customer into.
 */
export async function getCurrentStandardPrice(
  pool: DatabasePool,
  planKey: string,
  billingInterval: "month" | "year",
): Promise<PlanPriceRecord | null> {
  const result = await pool.query<PlanPriceDbRow>(
    `select pp.id, pp.plan_id, p.plan_key, pp.billing_interval, pp.amount_cents,
            pp.currency, pp.stripe_price_id_test, pp.stripe_price_id_live,
            pp.price_kind, pp.promo_key
     from public.plan_prices pp
     join public.plans p on p.id = pp.plan_id
     where p.plan_key = $1
       and pp.billing_interval = $2
       and pp.price_kind = 'standard'
       and pp.effective_to is null
     limit 1`,
    [planKey, billingInterval],
  );

  const row = result.rows[0];
  return row ? toPriceRecord(row) : null;
}

/**
 * Looks up a specific price row by its own id — what a plan-change flow
 * needs to know the org's *current* billing interval (`organization_
 * subscriptions.plan_price_id` only stores the id, not the interval),
 * without assuming every customer bills monthly.
 */
export async function getPlanPriceById(
  pool: DatabasePool,
  planPriceId: string,
): Promise<PlanPriceRecord | null> {
  const result = await pool.query<PlanPriceDbRow>(
    `select pp.id, pp.plan_id, p.plan_key, pp.billing_interval, pp.amount_cents,
            pp.currency, pp.stripe_price_id_test, pp.stripe_price_id_live,
            pp.price_kind, pp.promo_key
     from public.plan_prices pp
     join public.plans p on p.id = pp.plan_id
     where pp.id = $1
     limit 1`,
    [planPriceId],
  );

  const row = result.rows[0];
  return row ? toPriceRecord(row) : null;
}

/**
 * A named promotional price (e.g. "founding-business-79"), only returned
 * while it's genuinely still redeemable: active for new checkouts, within
 * its optional time window, and under its optional redemption cap. A
 * caller that finds nothing here should fall back to the standard price —
 * this never throws for an expired or exhausted promo, since "the promo
 * quietly stops being offered" is the correct behavior, not an error.
 */
export async function getRedeemablePromoPrice(
  pool: DatabasePool,
  promoKey: string,
): Promise<PlanPriceRecord | null> {
  const result = await pool.query<PlanPriceDbRow>(
    `select pp.id, pp.plan_id, p.plan_key, pp.billing_interval, pp.amount_cents,
            pp.currency, pp.stripe_price_id_test, pp.stripe_price_id_live,
            pp.price_kind, pp.promo_key
     from public.plan_prices pp
     join public.plans p on p.id = pp.plan_id
     where pp.promo_key = $1
       and pp.price_kind = 'promotional'
       and pp.is_active_for_new_checkouts = true
       and pp.effective_to is null
       and (pp.promo_starts_at is null or pp.promo_starts_at <= now())
       and (pp.promo_ends_at is null or pp.promo_ends_at > now())
       and (pp.promo_max_redemptions is null or pp.promo_redemptions_count < pp.promo_max_redemptions)
     limit 1`,
    [promoKey],
  );

  const row = result.rows[0];
  return row ? toPriceRecord(row) : null;
}

/**
 * Atomically increments a promotional price's redemption count — call
 * once per successful checkout that used it, never speculatively. The
 * `where` clause re-checks the cap at update time (not just at the
 * earlier `getRedeemablePromoPrice` read) to close the race between two
 * concurrent checkouts both reading "1 spot left."
 */
export async function recordPromoRedemption(
  pool: DatabasePool,
  planPriceId: string,
): Promise<boolean> {
  const result = await pool.query(
    `update public.plan_prices
     set promo_redemptions_count = promo_redemptions_count + 1
     where id = $1
       and (promo_max_redemptions is null or promo_redemptions_count < promo_max_redemptions)`,
    [planPriceId],
  );

  return (result.rowCount ?? 0) > 0;
}

export interface PlanAddon {
  readonly id: string;
  readonly addonKey: string;
  readonly name: string;
  readonly grantsUsers: number;
  readonly grantsActiveConnections: number;
  readonly amountCents: number;
  readonly billingInterval: "month" | "year";
  readonly stripePriceIdTest: string | null;
  readonly stripePriceIdLive: string | null;
}

interface PlanAddonDbRow {
  readonly id: string;
  readonly addon_key: string;
  readonly name: string;
  readonly grants_users: number;
  readonly grants_active_connections: number;
  readonly amount_cents: number;
  readonly billing_interval: "month" | "year";
  readonly stripe_price_id_test: string | null;
  readonly stripe_price_id_live: string | null;
}

/**
 * Only the add-ons currently offered — `is_enabled` is the explicit
 * "easy to disable" toggle for the capacity SKUs; a disabled add-on
 * simply stops appearing here for new purchases (existing purchases,
 * tracked in organization_subscription_addons, are untouched by this).
 */
export async function getEnabledPlanAddons(
  pool: DatabasePool,
): Promise<readonly PlanAddon[]> {
  const result = await pool.query<PlanAddonDbRow>(
    `select id, addon_key, name, grants_users, grants_active_connections,
            amount_cents, billing_interval, stripe_price_id_test, stripe_price_id_live
     from public.plan_addons
     where is_enabled = true
     order by amount_cents asc`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    addonKey: row.addon_key,
    name: row.name,
    grantsUsers: row.grants_users,
    grantsActiveConnections: row.grants_active_connections,
    amountCents: row.amount_cents,
    billingInterval: row.billing_interval,
    stripePriceIdTest: row.stripe_price_id_test,
    stripePriceIdLive: row.stripe_price_id_live,
  }));
}

export interface PlanRecord {
  readonly id: string;
  readonly planKey: string;
  readonly name: string;
  readonly supportsSelfServeCheckout: boolean;
}

/** Looked up by checkout to resolve a plan_key into the real plan row id. */
export async function getPlanByKey(
  pool: DatabasePool,
  planKey: string,
): Promise<PlanRecord | null> {
  const result = await pool.query<{
    id: string;
    plan_key: string;
    name: string;
    supports_self_serve_checkout: boolean;
  }>(
    `select id, plan_key, name, supports_self_serve_checkout
     from public.plans where plan_key = $1`,
    [planKey],
  );

  const row = result.rows[0];

  return row
    ? {
        id: row.id,
        planKey: row.plan_key,
        name: row.name,
        supportsSelfServeCheckout: row.supports_self_serve_checkout,
      }
    : null;
}
