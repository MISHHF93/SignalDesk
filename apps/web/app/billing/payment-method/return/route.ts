import { NextResponse } from "next/server";

import {
  attachDefaultPaymentMethod,
  createStripeBillingClient,
  retrieveSetupIntentPaymentMethod,
} from "@signaldesk/integrations/stripe-billing";
import {
  createDatabasePool,
  getOrganizationSubscription,
  type DatabasePool,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { checkRateLimit } from "../../../_lib/rate-limit";
import { recordAuditEventSafely } from "../../../_lib/safe-audit-event";
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
 *
 * Two real gaps found by review, both closing this route's own explicit
 * sibling claim: (1) every one of the 14 OAuth callback routes it names
 * itself as matching calls `checkRateLimit`; this route called it zero
 * times despite performing a real Stripe mutation plus a DB write — added,
 * scoped by organization like the other billing Server Actions
 * (`change-plan.ts`) rather than by IP like a pre-session OAuth callback,
 * since a real session already exists here. (2) the audit event sat inside
 * the same try/catch as `attachDefaultPaymentMethod` using plain
 * `recordAuditEvent` — the exact shape `recordAuditEventSafely`
 * (`_lib/safe-audit-event.ts`) exists to fix: a transient failure
 * recording *this* event would have redirected the user to
 * `payment_method_failed` even though their card was already attached
 * successfully. Every billing Server Action with this shape
 * (`change-plan.ts`/`manage-addon.ts`/`resume-subscription.ts`/
 * `cancel-subscription.ts`) already uses the safe wrapper; this route
 * didn't.
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

  const db = getPool();

  const rateLimit = await checkRateLimit(
    db,
    `payment-method-return:${session.organizationId}`,
    10,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("payment_method_failed");
  }

  try {
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
      subscription.stripeCustomerId,
    );

    if (!paymentMethodId) {
      return redirectTo("payment_method_failed");
    }

    await attachDefaultPaymentMethod(stripe, {
      customerId: subscription.stripeCustomerId,
      subscriptionId: subscription.stripeSubscriptionId,
      paymentMethodId,
    });

    await recordAuditEventSafely(db, session.organizationId, {
      userId: session.userId,
      eventType: "subscription.payment_method_updated",
      subjectType: "organization_subscription",
      subjectId: subscription.id,
      outcome: "succeeded",
      metadata: { stripeCustomerId: subscription.stripeCustomerId },
    });

    return redirectTo("payment_method_updated");
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "payment_method_return.attach",
      connectorSlug: "stripe",
      organizationId: session.organizationId,
    });
    return redirectTo("payment_method_failed");
  }
}
