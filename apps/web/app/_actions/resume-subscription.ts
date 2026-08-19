"use server";

import { redirect } from "next/navigation";

import {
  createStripeBillingClient,
  resumeSubscription,
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

export interface ResumeSubscriptionState {
  readonly error: string | null;
}

/**
 * Undoes a scheduled cancellation — only meaningful before the current
 * period actually ends (Stripe rejects `cancel_at_period_end: false` on a
 * subscription that has already been canceled outright). Updates the
 * local row directly right after the Stripe call succeeds, mirroring
 * `cancelSubscriptionAction`'s own reasoning.
 */
export async function resumeSubscriptionAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ResumeSubscriptionState,
): Promise<ResumeSubscriptionState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage your subscription." };
  }

  const rateLimit = checkRateLimit(
    `resume-subscription:${session.organizationId}`,
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
    return { error: "There's no subscription to resume." };
  }

  if (!subscription.cancelAtPeriodEnd) {
    return { error: "This subscription isn't scheduled to cancel." };
  }

  try {
    const stripe = createStripeBillingClient(getStripeSecretKey());
    await resumeSubscription(stripe, subscription.stripeSubscriptionId);

    await updateSubscriptionFromStripe(
      db,
      session.organizationId,
      subscription.stripeSubscriptionId,
      { status: subscription.status, cancelAtPeriodEnd: false },
    );

    await recordAuditEvent(db, session.organizationId, {
      userId: session.userId,
      eventType: "subscription.resumed",
      subjectType: "organization_subscription",
      subjectId: subscription.id,
      outcome: "succeeded",
      metadata: { stripeSubscriptionId: subscription.stripeSubscriptionId },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to resume the subscription."),
    };
  }

  redirect("/billing?billing=resumed");
}
