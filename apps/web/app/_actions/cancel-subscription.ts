"use server";

import { redirect } from "next/navigation";

import {
  cancelSubscriptionAtPeriodEnd,
  createStripeBillingClient,
} from "@business-dashboard/integrations/stripe-billing";
import {
  createDatabasePool,
  getOrganizationSubscription,
  recordAuditEvent,
  updateSubscriptionFromStripe,
  type DatabasePool,
} from "@business-dashboard/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { getStripeSecretKey } from "../_lib/stripe-billing-config";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export interface CancelSubscriptionState {
  readonly error: string | null;
}

/**
 * Real cancellation: "Cancel" always means "keep access until the period
 * already paid for ends," matching `cancelSubscriptionAtPeriodEnd`'s own
 * doc comment — never an immediate cutoff. Updates the local row directly
 * right after the Stripe call succeeds (the same pattern
 * `startCheckoutAction` uses for the initial row), so the UI reflects
 * reality immediately rather than waiting on webhook latency; the webhook
 * remains the authoritative sync point for everything else.
 */
export async function cancelSubscriptionAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: CancelSubscriptionState,
): Promise<CancelSubscriptionState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage your subscription." };
  }

  const rateLimit = checkRateLimit(
    `cancel-subscription:${session.organizationId}`,
    10,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return { error: "Too many attempts. Try again shortly." };
  }

  const db = getPool();
  const subscription = await getOrganizationSubscription(
    db,
    session.organizationId,
  );

  if (!subscription || !subscription.stripeSubscriptionId) {
    return { error: "There's no subscription to cancel." };
  }

  if (subscription.cancelAtPeriodEnd) {
    return { error: "This subscription is already set to cancel." };
  }

  try {
    const stripe = createStripeBillingClient(getStripeSecretKey());
    await cancelSubscriptionAtPeriodEnd(
      stripe,
      subscription.stripeSubscriptionId,
    );

    await updateSubscriptionFromStripe(
      db,
      session.organizationId,
      subscription.stripeSubscriptionId,
      { status: subscription.status, cancelAtPeriodEnd: true },
    );

    await recordAuditEvent(db, session.organizationId, {
      userId: session.userId,
      eventType: "subscription.cancel_requested",
      subjectType: "organization_subscription",
      subjectId: subscription.id,
      outcome: "succeeded",
      metadata: { stripeSubscriptionId: subscription.stripeSubscriptionId },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to cancel the subscription."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/billing?billing=cancel_scheduled");
}
