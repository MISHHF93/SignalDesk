import { NextResponse } from "next/server";

import {
  constructStripeWebhookEvent,
  createStripeBillingClient,
  mapStripeSubscriptionToSyncFields,
  type RawStripeSubscription,
} from "@signaldesk/integrations/stripe-billing";
import {
  createDatabasePool,
  findOrganizationIdByStripeCustomerId,
  findOrganizationIdByStripeSubscriptionId,
  updateSubscriptionFromStripe,
  type DatabasePool,
  type SubscriptionStatus,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { logger } from "../../../_lib/logger";
import {
  getStripeSecretKey,
  getStripeWebhookSecret,
  isWebhookConfigured,
} from "../../../_lib/stripe-billing-config";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

interface RawInvoice {
  readonly subscription: string | null;
  readonly customer: string | null;
}

/**
 * Resolves which organization owns this Stripe subscription (webhooks
 * identify the subscription, not the organization) and mirrors Stripe's
 * current state onto it, via the same `mapStripeSubscriptionToSyncFields`
 * mapping the reconciliation sweep (`api/cron/billing-reconciliation/
 * route.ts`) reads Stripe's raw payload through — one tested source of
 * truth for both paths, not two independent guesses. `eventCreatedAt`
 * (the real Stripe event's own `created` timestamp, not this handler's
 * own processing time) lets `updateSubscriptionFromStripe` reject this
 * write if a newer event already recorded fresher state — see that
 * function's own doc comment for why, since Stripe doesn't guarantee
 * webhook delivery order.
 */
async function syncSubscription(
  subscription: RawStripeSubscription,
  eventCreatedAt: Date,
): Promise<void> {
  const db = getPool();
  const organizationId =
    (await findOrganizationIdByStripeSubscriptionId(db, subscription.id)) ??
    (await findOrganizationIdByStripeCustomerId(db, subscription.customer));

  if (!organizationId) {
    logger.log("warn", "No organization found for subscription", {
      operation: "stripe_webhook.sync_subscription",
      correlationId: subscription.id,
    });
    return;
  }

  const fields = mapStripeSubscriptionToSyncFields(subscription);

  await updateSubscriptionFromStripe(db, organizationId, subscription.id, {
    ...fields,
    status: fields.status as SubscriptionStatus,
    stripeEventCreatedAt: eventCreatedAt,
  });
}

async function handleInvoicePaymentFailed(
  invoice: RawInvoice,
  eventCreatedAt: Date,
): Promise<void> {
  if (!invoice.subscription) {
    return;
  }

  const db = getPool();
  // Same subscription-id-first, customer-id-fallback resolution as
  // `syncSubscription` — found missing here by review: without it, a
  // subscription id this app hasn't recorded yet (the same edge case the
  // fallback exists for above) silently dropped this event entirely
  // instead of degrading the same way.
  const organizationId =
    (await findOrganizationIdByStripeSubscriptionId(
      db,
      invoice.subscription,
    )) ??
    (invoice.customer
      ? await findOrganizationIdByStripeCustomerId(db, invoice.customer)
      : null);

  if (!organizationId) {
    return;
  }

  await updateSubscriptionFromStripe(db, organizationId, invoice.subscription, {
    status: "past_due",
    stripeEventCreatedAt: eventCreatedAt,
  });
}

/**
 * Real Stripe Billing webhook sync — the authoritative point where
 * `organization_subscriptions` catches up to what Stripe actually did (a
 * trial converted, a payment succeeded or failed, a subscription was
 * canceled). Signature verified via Stripe's own SDK
 * (`constructStripeWebhookEvent`'s HMAC check), never trusted unverified —
 * this is a public, unauthenticated endpoint by necessity.
 *
 * Real replay protection already comes from the SDK, not just the
 * signature check: `constructStripeWebhookEvent` calls the Node SDK's
 * `stripe.webhooks.constructEvent(payload, header, secret)` with no
 * explicit `tolerance` argument, and that method's own default (confirmed
 * against the installed SDK — `Webhook.DEFAULT_TOLERANCE = 300` in
 * `stripe/cjs/Webhooks.js`) rejects any `stripe-signature` header whose
 * embedded `t=` timestamp is more than 5 minutes old, throwing before this
 * handler ever runs. A captured signature stops verifying on its own —
 * unlike QuickBooks' HMAC scheme (`quickbooks/webhook/route.ts`), which
 * carries no timestamp and needed its own realm-scoped rate limit instead.
 *
 * `invoice.paid` is intentionally not specially handled: the
 * `customer.subscription.updated` event Stripe sends alongside it already
 * carries the resulting `active` status, so there's nothing this handler
 * needs to do twice. `customer.subscription.trial_will_end` is logged
 * only — there is no email infrastructure in this app yet to notify the
 * customer.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isWebhookConfigured()) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = createStripeBillingClient(getStripeSecretKey());

  let event;

  try {
    event = constructStripeWebhookEvent(
      stripe,
      rawBody,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "stripe_webhook.verify_signature",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Stripe's own `created` is a Unix-seconds timestamp of when Stripe
  // generated this event — the real ordering signal `syncSubscription`/
  // `handleInvoicePaymentFailed` need, distinct from (and more meaningful
  // than) whenever this handler happens to process it.
  const eventCreatedAt = new Date(event.created * 1000);

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(
          event.data.object as unknown as RawStripeSubscription,
          eventCreatedAt,
        );
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          event.data.object as unknown as RawInvoice,
          eventCreatedAt,
        );
        break;
      case "customer.subscription.trial_will_end": {
        const subscription = event.data
          .object as unknown as RawStripeSubscription;
        logger.log("info", "Stripe trial ending soon", {
          operation: "stripe_webhook.trial_will_end",
          correlationId: subscription.id,
        });
        break;
      }
      default:
        // Unhandled event types are acknowledged, not treated as errors —
        // Stripe retries on a non-2xx response, and there's nothing this
        // handler needs to do with the other event types it's subscribed
        // to (or isn't).
        break;
    }
  } catch (error) {
    errorReporter.captureException(error, {
      operation: `stripe_webhook.handle.${event.type}`,
      correlationId: event.id,
    });
    return NextResponse.json(
      { error: "Webhook handling failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
