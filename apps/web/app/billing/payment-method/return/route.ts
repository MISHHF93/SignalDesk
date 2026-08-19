import { NextResponse } from "next/server";

import {
  attachDefaultPaymentMethod,
  createStripeBillingClient,
  retrieveSetupIntentPaymentMethod,
} from "@business-dashboard/integrations/stripe-billing";
import {
  createDatabasePool,
  getOrganizationSubscription,
  recordAuditEvent,
  type DatabasePool,
} from "@business-dashboard/persistence";

import { getCurrentOrganization } from "../../../_lib/session";
import { getStripeSecretKey } from "../../../_lib/stripe-billing-config";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the "add/update payment method" SetupIntent flow: Stripe
 * redirects here after `confirmSetup()` with `setup_intent`/
 * `redirect_status` in the query string (mirroring the checkout return's
 * own contract) — never the payment method id itself, so this retrieves
 * it server-side and attaches it as the customer's and subscription's
 * default. A real write triggered by a provider redirect, so this is a
 * Route Handler, matching every OAuth callback in this app, rather than a
 * page component silently mutating during render.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const setupIntentId = searchParams.get("setup_intent");
  const redirectStatus = searchParams.get("redirect_status");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/billing?billing=${status}`);

  if (redirectStatus !== "succeeded" || !setupIntentId) {
    return redirectTo("payment_method_failed");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/billing`);
  }

  try {
    const db = getPool();
    const subscription = await getOrganizationSubscription(
      db,
      session.organizationId,
    );

    if (
      !subscription ||
      !subscription.stripeCustomerId ||
      !subscription.stripeSubscriptionId
    ) {
      return redirectTo("payment_method_failed");
    }

    const stripe = createStripeBillingClient(getStripeSecretKey());
    const paymentMethodId = await retrieveSetupIntentPaymentMethod(
      stripe,
      setupIntentId,
    );

    if (!paymentMethodId) {
      return redirectTo("payment_method_failed");
    }

    await attachDefaultPaymentMethod(stripe, {
      customerId: subscription.stripeCustomerId,
      subscriptionId: subscription.stripeSubscriptionId,
      paymentMethodId,
    });

    await recordAuditEvent(db, session.organizationId, {
      userId: session.userId,
      eventType: "subscription.payment_method_updated",
      subjectType: "organization_subscription",
      subjectId: subscription.id,
      outcome: "succeeded",
      metadata: { stripeCustomerId: subscription.stripeCustomerId },
    });

    return redirectTo("payment_method_updated");
  } catch (error) {
    console.error("Failed to attach payment method after setup", error);
    return redirectTo("payment_method_failed");
  }
}
