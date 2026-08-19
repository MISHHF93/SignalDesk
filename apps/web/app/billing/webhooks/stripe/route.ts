import { NextResponse } from "next/server";

import {
  constructStripeWebhookEvent,
  createStripeBillingClient,
} from "@signaldesk/integrations/stripe-billing";
import {
  createDatabasePool,
  findOrganizationIdByStripeCustomerId,
  findOrganizationIdByStripeSubscriptionId,
  updateSubscriptionFromStripe,
  type DatabasePool,
  type SubscriptionStatus,
} from "@signaldesk/persistence";

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

// A deliberately loose read of just the fields this handler needs, cast
// via `as unknown as` from Stripe's real event payload rather than typed
// against the installed `stripe` SDK's `Subscription`/`Invoice` types —
// `current_period_start`/`current_period_end` moved off the Subscription
// object onto each SubscriptionItem in Stripe's current API (verified
// against docs.stripe.com/api/subscriptions/object this session, not
// training data), which the installed SDK version's types may not yet
// reflect at the top level either way. Every subscription this app
// creates has exactly one price item, so `items.data[0]` is that item.
interface RawSubscription {
  readonly id: string;
  readonly customer: string;
  readonly status: SubscriptionStatus;
  readonly trial_end: number | null;
  readonly cancel_at_period_end: boolean;
  readonly canceled_at: number | null;
  readonly items: {
    readonly data: ReadonlyArray<{
      readonly current_period_start: number;
      readonly current_period_end: number;
    }>;
  };
}

interface RawInvoice {
  readonly subscription: string | null;
}

function toDate(unixSeconds: number | null): Date | null {
  return unixSeconds === null ? null : new Date(unixSeconds * 1000);
}

async function syncSubscription(subscription: RawSubscription): Promise<void> {
  const db = getPool();
  const organizationId =
    (await findOrganizationIdByStripeSubscriptionId(db, subscription.id)) ??
    (await findOrganizationIdByStripeCustomerId(db, subscription.customer));

  if (!organizationId) {
    console.warn(
      `Stripe webhook: no organization found for subscription ${subscription.id}`,
    );
    return;
  }

  const item = subscription.items.data[0];

  await updateSubscriptionFromStripe(db, organizationId, subscription.id, {
    status: subscription.status,
    trialEndsAt: toDate(subscription.trial_end),
    currentPeriodStart: item ? toDate(item.current_period_start) : null,
    currentPeriodEnd: item ? toDate(item.current_period_end) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: toDate(subscription.canceled_at),
  });
}

async function handleInvoicePaymentFailed(invoice: RawInvoice): Promise<void> {
  if (!invoice.subscription) {
    return;
  }

  const db = getPool();
  const organizationId = await findOrganizationIdByStripeSubscriptionId(
    db,
    invoice.subscription,
  );

  if (!organizationId) {
    return;
  }

  await updateSubscriptionFromStripe(db, organizationId, invoice.subscription, {
    status: "past_due",
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
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as unknown as RawSubscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          event.data.object as unknown as RawInvoice,
        );
        break;
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as unknown as RawSubscription;
        console.log(
          `Stripe trial ending soon for subscription ${subscription.id}`,
        );
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
    console.error(`Stripe webhook handling failed for ${event.type}`, error);
    return NextResponse.json(
      { error: "Webhook handling failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
