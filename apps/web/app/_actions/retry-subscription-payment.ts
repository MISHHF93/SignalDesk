"use server";

import {
  createStripeBillingClient,
  retrieveIncompleteSubscriptionClientSecret,
} from "@signaldesk/integrations/stripe-billing";
import {
  createDatabasePool,
  getOrganizationSubscription,
  type DatabasePool,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  getStripeSecretKey,
  isBillingConfigured,
} from "../_lib/stripe-billing-config";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export interface RetryPaymentState {
  readonly error: string | null;
  readonly clientSecret: string | null;
}

/**
 * A subscription left `incomplete` — an abandoned checkout, a declined
 * card — had no way back before this: the checkout page refuses to start
 * a second subscription once one exists, and nothing re-fetched the
 * original invoice's client secret. This re-opens the same Payment
 * Element flow against the existing subscription's still-unpaid invoice
 * rather than creating a duplicate one.
 */
export async function retryPaymentAction(): Promise<RetryPaymentState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to do this.", clientSecret: null };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `retry-payment:${session.organizationId}`,
    10,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: "Too many attempts. Try again shortly.",
      clientSecret: null,
    };
  }

  // See start-payment-method-setup.ts's identical check: `getStripeSecretKey()`
  // alone would let this succeed with only half of billing configured,
  // leaving the client with a real `clientSecret` and no publishable key to
  // render it with (found by a deep audit, 2026-08-23).
  if (!isBillingConfigured()) {
    return { error: "Billing is not configured yet.", clientSecret: null };
  }

  const db = getPool();
  const subscription = await getOrganizationSubscription(
    db,
    session.organizationId,
  );

  if (!subscription || !subscription.stripeSubscriptionId) {
    return { error: "There's no subscription to retry.", clientSecret: null };
  }

  if (subscription.status !== "incomplete") {
    return {
      error: "This subscription doesn't need a payment retry.",
      clientSecret: null,
    };
  }

  try {
    const stripe = createStripeBillingClient(getStripeSecretKey());
    const clientSecret = await retrieveIncompleteSubscriptionClientSecret(
      stripe,
      subscription.stripeSubscriptionId,
    );

    if (!clientSecret) {
      return {
        error:
          "There's nothing left to confirm on this subscription. Contact support.",
        clientSecret: null,
      };
    }

    return { error: null, clientSecret };
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to resume checkout."),
      clientSecret: null,
    };
  }
}
