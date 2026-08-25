import type Stripe from "stripe";

/**
 * A deliberately loose read of just the fields the sync logic below needs,
 * cast via `as unknown as` from Stripe's real Subscription object rather
 * than typed against the installed `stripe` SDK's `Subscription` type —
 * `current_period_start`/`current_period_end` moved off the Subscription
 * object onto each SubscriptionItem in Stripe's current API (verified
 * against docs.stripe.com/api/subscriptions/object this session, not
 * training data), which the installed SDK version's types may not yet
 * reflect at the top level either way. `items.data[0]` is read here
 * regardless of whether an add-on item also exists on this subscription
 * (`addSubscriptionAddonItem`, client.ts) — safe only because this app
 * never opts into Stripe's per-item "flexible" billing mode, so every
 * item on one subscription shares the same billing-cycle bounds under
 * the default "classic" mode; it would NOT be safe to read `data[0]` this
 * way for anything price- or item-identity-specific (see
 * `getSubscriptionItemId`'s own doc comment, client.ts, for a case where
 * that distinction is exactly the real bug it fixes).
 *
 * Shared between the real-time webhook handler
 * (`apps/web/app/billing/webhooks/stripe/route.ts`) and the billing
 * reconciliation sweep (`apps/web/app/api/cron/billing-reconciliation/
 * route.ts`, LAUNCH-BLOCKERS.md P1 #8) so both read Stripe's raw payload
 * through the exact same mapping — one tested source of truth for "what
 * does this Stripe subscription mean," not two independent guesses that
 * could quietly drift apart from each other.
 */
export interface RawStripeSubscription {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
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

export interface StripeSubscriptionSyncFields {
  readonly status: string;
  readonly trialEndsAt: Date | null;
  readonly currentPeriodStart: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt: Date | null;
}

function toDate(unixSeconds: number | null): Date | null {
  return unixSeconds === null ? null : new Date(unixSeconds * 1000);
}

/**
 * The single mapping from Stripe's raw subscription shape to the fields
 * this app persists (`@signaldesk/persistence`'s
 * `UpdateSubscriptionFromStripeInput`, structurally — this package
 * deliberately doesn't depend on `@signaldesk/persistence` to stay a
 * provider-only layer, matching every other connector mapper here).
 */
export function mapStripeSubscriptionToSyncFields(
  subscription: RawStripeSubscription,
): StripeSubscriptionSyncFields {
  const item = subscription.items.data[0];

  return {
    status: subscription.status,
    trialEndsAt: toDate(subscription.trial_end),
    currentPeriodStart: item ? toDate(item.current_period_start) : null,
    currentPeriodEnd: item ? toDate(item.current_period_end) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: toDate(subscription.canceled_at),
  };
}

/**
 * Fetches a subscription's current, authoritative state directly from
 * Stripe — the reconciliation sweep's whole reason to exist. A missed or
 * out-of-order webhook leaves local state stale; asking Stripe fresh here
 * is correct regardless of delivery order, unlike trying to reconstruct
 * the right state from a possibly-reordered stream of past events.
 */
export async function retrieveRawSubscription(
  stripe: Stripe,
  subscriptionId: string,
): Promise<RawStripeSubscription> {
  return (await stripe.subscriptions.retrieve(
    subscriptionId,
  )) as unknown as RawStripeSubscription;
}
