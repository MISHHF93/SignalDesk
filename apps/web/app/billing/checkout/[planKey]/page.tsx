import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  createDatabasePool,
  getCurrentStandardPrice,
  getOrganizationSubscription,
  getPlanCatalog,
  getRedeemablePromoPrice,
  type DatabasePool,
  type SubscriptionStatus,
} from "@business-dashboard/persistence";

import { getCurrentOrganization } from "../../../_lib/session";
import { isBillingConfigured } from "../../../_lib/stripe-billing-config";
import { CheckoutClient } from "./checkout-client";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const SELF_SERVE_PLAN_KEYS = new Set(["starter", "business", "scale"]);

/** Mirrors start-checkout.ts's RESUBSCRIBABLE_STATUSES — a subscription in
 * either state has fully ended, so checkout should let it through rather
 * than blocking with a stale "you already have a subscription" notice. */
const RESUBSCRIBABLE_STATUSES = new Set<SubscriptionStatus>([
  "canceled",
  "incomplete_expired",
]);

export const metadata: Metadata = { title: "Checkout" };

function formatPrice(cents: number, interval: "month" | "year"): string {
  const amount = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
  return `${amount}/${interval === "month" ? "mo" : "yr"}`;
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ planKey: string }>;
  searchParams: Promise<{ interval?: string; promo?: string }>;
}) {
  const { planKey } = await params;
  const { interval, promo } = await searchParams;
  const billingInterval = interval === "year" ? "year" : "month";

  if (!SELF_SERVE_PLAN_KEYS.has(planKey)) {
    notFound();
  }

  const session = await getCurrentOrganization();

  if (!session) {
    redirect(
      `/login?next=${encodeURIComponent(`/billing/checkout/${planKey}${interval ? `?interval=${interval}` : ""}`)}`,
    );
  }

  const db = getPool();
  const catalog = await getPlanCatalog(db);
  const plan = catalog.find((entry) => entry.planKey === planKey);

  if (!plan) {
    notFound();
  }

  const billingConfigured = isBillingConfigured();
  const existingSubscription = await getOrganizationSubscription(
    db,
    session.organizationId,
  );

  const price = promo
    ? await getRedeemablePromoPrice(db, promo)
    : await getCurrentStandardPrice(db, planKey, billingInterval);
  const priceBelongsToPlan = price && price.planKey === planKey;

  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="checkout-heading">
        <div>
          <p className="sectionKicker">Checkout</p>
          <h1 id="checkout-heading">Subscribe to {plan.name}</h1>
          <p>{plan.differentiationSummary}</p>
        </div>
      </section>

      {!billingConfigured ? (
        <aside
          className="honestyNotice"
          aria-labelledby="billing-notice-heading"
        >
          <span className="noticeIcon" aria-hidden="true">
            ⚠
          </span>
          <div>
            <h2 id="billing-notice-heading">
              Billing isn&rsquo;t configured yet
            </h2>
            <p>
              Set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to
              enable checkout.
            </p>
          </div>
        </aside>
      ) : existingSubscription &&
        !RESUBSCRIBABLE_STATUSES.has(existingSubscription.status) ? (
        <aside
          className="honestyNotice"
          aria-labelledby="billing-notice-heading"
        >
          <span className="noticeIcon" aria-hidden="true">
            ✓
          </span>
          <div>
            <h2 id="billing-notice-heading">
              Your organization already has a subscription
            </h2>
            <p>
              Status: {existingSubscription.status}. Contact support to make
              changes.
            </p>
          </div>
        </aside>
      ) : session.isAnonymous || !session.email ? (
        <aside
          className="honestyNotice"
          aria-labelledby="billing-notice-heading"
        >
          <span className="noticeIcon" aria-hidden="true">
            ⚠
          </span>
          <div>
            <h2 id="billing-notice-heading">Create a real account first</h2>
            <p>Subscriptions need a real, email-verified account.</p>
          </div>
        </aside>
      ) : !priceBelongsToPlan ? (
        <aside
          className="honestyNotice"
          aria-labelledby="billing-notice-heading"
        >
          <span className="noticeIcon" aria-hidden="true">
            ⚠
          </span>
          <div>
            <h2 id="billing-notice-heading">
              {promo
                ? "That promotional offer is no longer available"
                : "Pricing isn't available for that interval yet"}
            </h2>
            <p>
              Try the standard monthly or annual price from the pricing page.
            </p>
          </div>
        </aside>
      ) : (
        <section
          className="checkoutPanel"
          aria-labelledby="checkout-details-heading"
        >
          <h2 id="checkout-details-heading">
            {price.amountCents !== null
              ? formatPrice(price.amountCents, billingInterval)
              : "Custom pricing"}
            {price.promoKey ? " · promotional price" : ""}
          </h2>
          <CheckoutClient
            planKey={planKey}
            billingInterval={billingInterval}
            promoKey={promo ?? null}
            showTrialOption={planKey === "business"}
          />
        </section>
      )}
    </main>
  );
}
