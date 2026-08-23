"use server";

import {
  createSetupIntentForCustomer,
  createStripeBillingClient,
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

export type StartPaymentMethodSetupResult =
  | { readonly ok: true; readonly clientSecret: string }
  | { readonly ok: false; readonly error: string };

/**
 * Starts a real Stripe SetupIntent so the browser can collect a new card
 * without charging anything — the flow this app was missing entirely
 * before now: a Business trial with no card added yet auto-cancels
 * instead of converting (see `createTrialSubscription`'s own doc comment),
 * and a `past_due` subscription had no way to fix a failed card short of
 * contacting support directly.
 */
export async function startPaymentMethodSetupAction(): Promise<StartPaymentMethodSetupResult> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { ok: false, error: "Sign in to do this." };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `payment-method-setup:${session.organizationId}`,
    10,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many attempts. Try again shortly." };
  }

  // `getStripeSecretKey()` alone would let this succeed with only half of
  // billing configured — the client-side Payment Element also needs
  // `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and without it the browser has a
  // real `clientSecret` but nothing to render it with, a silent dead end
  // (found by a deep audit, 2026-08-23; `isBillingConfigured()` already
  // checks both and is the pattern `start-checkout.ts` established).
  if (!isBillingConfigured()) {
    return { ok: false, error: "Billing is not configured yet." };
  }

  try {
    const db = getPool();
    const subscription = await getOrganizationSubscription(
      db,
      session.organizationId,
    );

    if (!subscription || !subscription.stripeCustomerId) {
      return { ok: false, error: "There's no subscription to add a card to." };
    }

    const stripe = createStripeBillingClient(getStripeSecretKey());
    const setupIntent = await createSetupIntentForCustomer(
      stripe,
      subscription.stripeCustomerId,
    );

    return { ok: true, clientSecret: setupIntent.clientSecret };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(
        error,
        "Failed to start payment method setup.",
      ),
    };
  }
}
