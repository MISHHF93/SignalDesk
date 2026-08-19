"use server";

import { redirect } from "next/navigation";

import {
  createStripeBillingClient,
  createStripeCustomer,
  createSubscriptionWithImmediatePayment,
  createTrialSubscription,
} from "@business-dashboard/integrations/stripe-billing";
import {
  createDatabasePool,
  createOrganizationSubscription,
  getCurrentStandardPrice,
  getOrganizationSubscription,
  getPlanByKey,
  getRedeemablePromoPrice,
  recordPromoRedemption,
  resurrectOrganizationSubscription,
  type DatabasePool,
  type SubscriptionStatus,
} from "@business-dashboard/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  getStripeMode,
  getStripeSecretKey,
  isBillingConfigured,
  resolveStripePriceId,
} from "../_lib/stripe-billing-config";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export interface StartCheckoutState {
  readonly error: string | null;
  /** Present once an immediate-payment subscription has been created and
   * needs the client to mount the Payment Element and confirm it. */
  readonly clientSecret: string | null;
}

const SELF_SERVE_PLAN_KEYS = new Set(["starter", "business", "scale"]);

/** A subscription in either state has fully ended — Stripe has nothing
 * left to retry or resume, so checkout should offer a brand new
 * subscription rather than refusing outright. Every other status has a
 * real, still-relevant Stripe subscription and must go through `/billing`
 * (cancel, resume, retry payment) instead of starting a second one. */
const RESUBSCRIBABLE_STATUSES = new Set<SubscriptionStatus>([
  "canceled",
  "incomplete_expired",
]);

/**
 * Starts real billing checkout. Two distinct outcomes:
 *
 * - Business's no-card trial completes entirely server-side (no payment
 *   method to collect) and redirects straight to a confirmation page.
 * - Every other path (Starter, Scale, or Business explicitly skipping its
 *   trial) creates a real `incomplete` Stripe subscription and returns a
 *   client secret for the caller to mount `@stripe/react-stripe-js`'s
 *   Payment Element against — the subscription only becomes `active` once
 *   the customer confirms payment and the webhook syncs the result.
 *
 * `organizationId` is never accepted as input — derived exclusively from
 * the authenticated session, matching every other real Server Action in
 * this app (ADR 0005).
 */
export async function startCheckoutAction(
  _prevState: StartCheckoutState,
  formData: FormData,
): Promise<StartCheckoutState> {
  const session = await getCurrentOrganization();

  if (!session) {
    redirect(
      `/login?next=${encodeURIComponent(String(formData.get("next") ?? "/pricing"))}`,
    );
  }

  const email = session.email;

  if (session.isAnonymous || !email) {
    return {
      error: "Create a real account with an email before subscribing.",
      clientSecret: null,
    };
  }

  const rateLimit = checkRateLimit(
    `start-checkout:${session.organizationId}`,
    10,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: "Too many checkout attempts. Try again shortly.",
      clientSecret: null,
    };
  }

  if (!isBillingConfigured()) {
    return { error: "Billing is not configured yet.", clientSecret: null };
  }

  const planKey = String(formData.get("planKey") ?? "");
  const billingInterval = String(formData.get("billingInterval") ?? "month");
  const promoKey = formData.get("promoKey");
  const wantsTrial = formData.get("mode") === "trial";

  if (!SELF_SERVE_PLAN_KEYS.has(planKey)) {
    return {
      error: "That plan isn't available for self-serve checkout.",
      clientSecret: null,
    };
  }

  if (billingInterval !== "month" && billingInterval !== "year") {
    return { error: "Invalid billing interval.", clientSecret: null };
  }

  if (wantsTrial && planKey !== "business") {
    return { error: "Only Business offers a trial.", clientSecret: null };
  }

  // `redirect()` throws a special Next.js control-flow error that must
  // propagate uncaught — it cannot be called from inside the try block
  // below, or the catch clause would mistake it for a real failure. The
  // trial path instead sets this flag and redirects after the try/catch
  // has fully exited.
  let trialStarted = false;

  const outcome = await (async (): Promise<StartCheckoutState> => {
    try {
      const db = getPool();

      const existing = await getOrganizationSubscription(
        db,
        session.organizationId,
      );

      if (existing && !RESUBSCRIBABLE_STATUSES.has(existing.status)) {
        return {
          error:
            "Your organization already has a subscription on file. Contact support to change it.",
          clientSecret: null,
        };
      }

      // A prior subscription fully ended — resurrect the same row into a
      // brand new Stripe subscription rather than inserting a second one
      // (organization_subscriptions_org_unique allows only one row per
      // organization; see resurrectOrganizationSubscription's doc comment).
      const isResubscribing = existing !== null;

      const plan = await getPlanByKey(db, planKey);

      if (!plan || !plan.supportsSelfServeCheckout) {
        return {
          error: "That plan isn't available for self-serve checkout.",
          clientSecret: null,
        };
      }

      const price =
        typeof promoKey === "string" && promoKey
          ? await getRedeemablePromoPrice(db, promoKey)
          : await getCurrentStandardPrice(db, planKey, billingInterval);

      if (!price || price.planKey !== planKey) {
        return {
          error:
            typeof promoKey === "string" && promoKey
              ? "This promotional offer is no longer available."
              : "Pricing for that plan isn't available right now.",
          clientSecret: null,
        };
      }

      const stripePriceId = resolveStripePriceId(price);

      if (!stripePriceId) {
        return {
          error: "This plan isn't available for checkout yet.",
          clientSecret: null,
        };
      }

      const stripe = createStripeBillingClient(getStripeSecretKey());
      const customer = await createStripeCustomer(stripe, {
        email,
        organizationId: session.organizationId,
      });
      const stripeMode = getStripeMode();

      if (wantsTrial) {
        const trial = await createTrialSubscription(stripe, {
          customerId: customer.id,
          priceId: stripePriceId,
          trialDays: 14,
        });

        const trialSubscriptionInput = {
          planId: plan.id,
          planPriceId: price.id,
          status: "trialing" as const,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: trial.subscriptionId,
          stripeMode,
          trialEndsAt: trial.trialEndsAt,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        };
        const savedTrial = isResubscribing
          ? await resurrectOrganizationSubscription(
              db,
              session.organizationId,
              trialSubscriptionInput,
            )
          : await createOrganizationSubscription(
              db,
              session.organizationId,
              trialSubscriptionInput,
            );

        if (!savedTrial) {
          return {
            error: "Checkout failed. Please try again.",
            clientSecret: null,
          };
        }

        if (price.promoKey) {
          await recordPromoRedemption(db, price.id);
        }

        trialStarted = true;
        return { error: null, clientSecret: null };
      }

      const result = await createSubscriptionWithImmediatePayment(stripe, {
        customerId: customer.id,
        priceId: stripePriceId,
      });

      const paidSubscriptionInput = {
        planId: plan.id,
        planPriceId: price.id,
        status: "incomplete" as const,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: result.subscriptionId,
        stripeMode,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      };
      const savedSubscription = isResubscribing
        ? await resurrectOrganizationSubscription(
            db,
            session.organizationId,
            paidSubscriptionInput,
          )
        : await createOrganizationSubscription(
            db,
            session.organizationId,
            paidSubscriptionInput,
          );

      if (!savedSubscription) {
        return {
          error: "Checkout failed. Please try again.",
          clientSecret: null,
        };
      }

      if (price.promoKey) {
        await recordPromoRedemption(db, price.id);
      }

      return { error: null, clientSecret: result.clientSecret };
    } catch (error) {
      return {
        error: describeActionError(error, "Checkout failed."),
        clientSecret: null,
      };
    }
  })();

  if (trialStarted) {
    redirect("/billing/checkout/trial-started");
  }

  return outcome;
}
