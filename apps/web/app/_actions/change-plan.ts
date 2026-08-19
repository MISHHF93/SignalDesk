"use server";

import { redirect } from "next/navigation";

import {
  createStripeBillingClient,
  getSubscriptionItemId,
  previewPriceChangeInvoice,
  updateSubscriptionPrice,
} from "@business-dashboard/integrations/stripe-billing";
import {
  createDatabasePool,
  getCurrentStandardPrice,
  getOrganizationSubscription,
  getPlanByKey,
  getPlanPriceById,
  recordAuditEvent,
  updateSubscriptionFromStripe,
  type DatabasePool,
} from "@business-dashboard/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  getStripeSecretKey,
  resolveStripePriceId,
} from "../_lib/stripe-billing-config";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const SELF_SERVE_PLAN_KEYS = new Set(["starter", "business", "scale"]);

async function resolveTargetPrice(db: DatabasePool, newPlanKey: string) {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to do this." } as const;
  }

  if (!SELF_SERVE_PLAN_KEYS.has(newPlanKey)) {
    return {
      error: "That plan isn't available for self-serve changes.",
    } as const;
  }

  const subscription = await getOrganizationSubscription(
    db,
    session.organizationId,
  );

  if (!subscription || !subscription.stripeSubscriptionId) {
    return { error: "There's no subscription to change." } as const;
  }

  if (subscription.planKey === newPlanKey) {
    return { error: "You're already on this plan." } as const;
  }

  // Preserve the org's current billing interval — a plan change is not
  // also a monthly/annual switch, and organization_subscriptions only
  // stores the price id, not the interval it locks in.
  const currentPrice = subscription.planPriceId
    ? await getPlanPriceById(db, subscription.planPriceId)
    : null;
  const billingInterval = currentPrice?.billingInterval ?? "month";

  const [plan, newPrice] = await Promise.all([
    getPlanByKey(db, newPlanKey),
    getCurrentStandardPrice(db, newPlanKey, billingInterval),
  ]);

  if (!plan || !plan.supportsSelfServeCheckout || !newPrice) {
    return {
      error: "That plan isn't available for self-serve changes.",
    } as const;
  }

  const stripePriceId = resolveStripePriceId(newPrice);

  if (!stripePriceId) {
    return { error: "That plan isn't available for checkout yet." } as const;
  }

  return { session, subscription, plan, newPrice, stripePriceId } as const;
}

export type PreviewPlanChangeResult =
  | {
      readonly ok: true;
      readonly amountDueCents: number;
      readonly currency: string;
      readonly planName: string;
    }
  | { readonly ok: false; readonly error: string };

/**
 * Shows the real prorated amount before a customer commits to a plan
 * change — Stripe's own preview-invoice endpoint, never a locally
 * estimated number.
 */
export async function previewPlanChangeAction(
  newPlanKey: string,
): Promise<PreviewPlanChangeResult> {
  try {
    const db = getPool();
    const resolved = await resolveTargetPrice(db, newPlanKey);

    if ("error" in resolved) {
      return { ok: false, error: resolved.error };
    }

    const { subscription, plan, stripePriceId } = resolved;
    const stripe = createStripeBillingClient(getStripeSecretKey());
    const subscriptionItemId = await getSubscriptionItemId(
      stripe,
      subscription.stripeSubscriptionId as string,
    );

    if (!subscriptionItemId || !subscription.stripeCustomerId) {
      return {
        ok: false,
        error: "Couldn't read your current subscription from Stripe.",
      };
    }

    const preview = await previewPriceChangeInvoice(stripe, {
      customerId: subscription.stripeCustomerId,
      subscriptionId: subscription.stripeSubscriptionId as string,
      subscriptionItemId,
      newPriceId: stripePriceId,
    });

    return {
      ok: true,
      amountDueCents: preview.amountDueCents,
      currency: preview.currency,
      planName: plan.name,
    };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to preview the plan change."),
    };
  }
}

export interface ChangePlanState {
  readonly error: string | null;
}

/**
 * Performs the real plan change: swaps the Stripe subscription item's
 * price with real proration, then updates the local row directly (same
 * "don't wait on webhook latency" pattern as cancel/resume/checkout).
 */
export async function changePlanAction(
  newPlanKey: string,
): Promise<ChangePlanState> {
  const db = getPool();
  // Re-derived inside resolveTargetPrice too — cheap, since
  // getCurrentOrganization() is memoized per request (React cache()).
  const callerSession = await getCurrentOrganization();

  if (!callerSession) {
    return { error: "Sign in to do this." };
  }

  const rateLimit = checkRateLimit(
    `change-plan:${callerSession.organizationId}`,
    10,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return { error: "Too many attempts. Try again shortly." };
  }

  const resolved = await resolveTargetPrice(db, newPlanKey);

  if ("error" in resolved) {
    return { error: resolved.error };
  }

  const { session, subscription, plan, newPrice, stripePriceId } = resolved;

  try {
    const stripe = createStripeBillingClient(getStripeSecretKey());
    const subscriptionItemId = await getSubscriptionItemId(
      stripe,
      subscription.stripeSubscriptionId as string,
    );

    if (!subscriptionItemId) {
      return { error: "Couldn't read your current subscription from Stripe." };
    }

    const result = await updateSubscriptionPrice(stripe, {
      subscriptionId: subscription.stripeSubscriptionId as string,
      subscriptionItemId,
      newPriceId: stripePriceId,
    });

    await updateSubscriptionFromStripe(
      db,
      session.organizationId,
      subscription.stripeSubscriptionId as string,
      {
        status: result.status as typeof subscription.status,
        planId: plan.id,
        planPriceId: newPrice.id,
      },
    );

    await recordAuditEvent(db, session.organizationId, {
      userId: session.userId,
      eventType: "subscription.plan_changed",
      subjectType: "organization_subscription",
      subjectId: subscription.id,
      outcome: "succeeded",
      metadata: {
        fromPlanKey: subscription.planKey,
        toPlanKey: newPlanKey,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to change your plan."),
    };
  }

  redirect("/billing?billing=plan_changed");
}
