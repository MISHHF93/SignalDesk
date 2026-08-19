/**
 * Real Stripe Billing (Products/Prices/Customers/Subscriptions) client —
 * this app charging its own customers, not the separate Stripe Connect
 * connector in `../stripe` (which reads a customer's own Stripe revenue
 * data). Both can share one Stripe account/secret key; they're
 * unrelated API surfaces of the same provider.
 *
 * Verified against Stripe's current docs this session
 * (docs.stripe.com/billing/subscriptions/build-subscriptions, Elements +
 * PaymentIntents variant, and docs.stripe.com/billing/subscriptions/
 * trials), not assumed from training data — notably: the current flow
 * expands `latest_invoice.confirmation_secret.client_secret` for Payment
 * Element (not the older `latest_invoice.payment_intent.client_secret`
 * pattern), and a genuine no-card free trial uses the classic
 * `trial_period_days` + `trial_settings.end_behavior.missing_payment_method`
 * parameters — deliberately NOT Stripe's newer Trial Offer API (a preview
 * feature requiring a dated `Stripe-Version` header, built for far more
 * complex discounted/paid-trial pricing experiments than "give one plan
 * a plain 14-day free trial").
 */

import Stripe from "stripe";

export function createStripeBillingClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export interface CreateStripeCustomerInput {
  readonly email: string;
  readonly name?: string;
  readonly organizationId: string;
}

export async function createStripeCustomer(
  stripe: Stripe,
  input: CreateStripeCustomerInput,
): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email: input.email,
    ...(input.name !== undefined ? { name: input.name } : {}),
    metadata: { organizationId: input.organizationId },
  });
}

export interface TrialSubscriptionResult {
  readonly subscriptionId: string;
  readonly status: string;
  readonly trialEndsAt: Date | null;
}

/**
 * A genuine no-card trial: no payment method is collected at all, the
 * subscription becomes `trialing` immediately. If the trial ends with no
 * payment method ever attached, Stripe cancels it outright
 * (`missing_payment_method: 'cancel'`) rather than leaving a `paused`
 * subscription that would need explicit resume handling this app doesn't
 * build for v1.
 */
export async function createTrialSubscription(
  stripe: Stripe,
  input: { customerId: string; priceId: string; trialDays: number },
): Promise<TrialSubscriptionResult> {
  const subscription = await stripe.subscriptions.create({
    customer: input.customerId,
    items: [{ price: input.priceId }],
    trial_period_days: input.trialDays,
    trial_settings: {
      end_behavior: { missing_payment_method: "cancel" },
    },
  });

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    trialEndsAt: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
  };
}

export interface ImmediatePaymentSubscriptionResult {
  readonly subscriptionId: string;
  readonly status: string;
  /** Pass to the client as Stripe.js Elements' `clientSecret` option to
   * mount and confirm the Payment Element. */
  readonly clientSecret: string;
}

/**
 * Standard "pay now" subscription creation (Starter/Scale, or Business
 * converting after its trial): the subscription starts `incomplete` and
 * the returned client secret confirms payment via the embedded Payment
 * Element on the front end.
 */
export async function createSubscriptionWithImmediatePayment(
  stripe: Stripe,
  input: { customerId: string; priceId: string },
): Promise<ImmediatePaymentSubscriptionResult> {
  const subscription = await stripe.subscriptions.create({
    customer: input.customerId,
    items: [{ price: input.priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.confirmation_secret"],
  });

  const invoice = subscription.latest_invoice;

  if (!invoice || typeof invoice === "string") {
    throw new Error(
      "Stripe subscription creation did not return an expanded invoice",
    );
  }

  // `confirmation_secret` isn't yet in this SDK version's invoice type
  // (it's a newer API field than the installed @types cover), but it's
  // real and present in the raw response — see this module's doc comment
  // on why this is the current, correct field to read.
  const confirmationSecret = (
    invoice as unknown as {
      confirmation_secret?: { client_secret?: string };
    }
  ).confirmation_secret;
  const clientSecret = confirmationSecret?.client_secret;

  if (!clientSecret) {
    throw new Error(
      "Stripe invoice response did not include confirmation_secret.client_secret",
    );
  }

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    clientSecret,
  };
}

/**
 * Re-fetches the client secret for an already-created `incomplete`
 * subscription's unpaid invoice — lets a customer who abandoned checkout
 * or had a card declined come back and confirm payment again without
 * creating a second, duplicate subscription. `null` (not thrown) when
 * there's nothing left to confirm (e.g. the invoice was voided), so the
 * caller can fail closed rather than mount a broken Payment Element.
 */
export async function retrieveIncompleteSubscriptionClientSecret(
  stripe: Stripe,
  subscriptionId: string,
): Promise<string | null> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice.confirmation_secret"],
  });

  const invoice = subscription.latest_invoice;

  if (!invoice || typeof invoice === "string") {
    return null;
  }

  const confirmationSecret = (
    invoice as unknown as {
      confirmation_secret?: { client_secret?: string };
    }
  ).confirmation_secret;

  return confirmationSecret?.client_secret ?? null;
}

export interface SetupIntentResult {
  readonly clientSecret: string;
}

/**
 * "Add a payment method" without charging anything — used to let a
 * trialing customer attach a card before (or after) their trial ends,
 * via the Payment Element in `mode: 'setup'`.
 */
export async function createSetupIntentForCustomer(
  stripe: Stripe,
  customerId: string,
): Promise<SetupIntentResult> {
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
  });

  if (!setupIntent.client_secret) {
    throw new Error("Stripe SetupIntent response had no client_secret");
  }

  return { clientSecret: setupIntent.client_secret };
}

/**
 * Reads back which payment method a completed SetupIntent actually
 * produced — the browser-side `confirmSetup()` call only redirects with
 * the SetupIntent's id, never the payment method id itself, so the
 * server-side return handler needs this to know what to attach. `null`
 * (not thrown) for a SetupIntent Stripe reports as not actually
 * succeeded/populated yet — the caller decides how to react.
 */
export async function retrieveSetupIntentPaymentMethod(
  stripe: Stripe,
  setupIntentId: string,
): Promise<string | null> {
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

  return typeof setupIntent.payment_method === "string"
    ? setupIntent.payment_method
    : null;
}

/**
 * Attaches a payment method (already confirmed via a SetupIntent on the
 * client) as the customer's and subscription's default — needed so
 * future renewal invoices actually have something to charge.
 */
export async function attachDefaultPaymentMethod(
  stripe: Stripe,
  input: {
    customerId: string;
    subscriptionId: string;
    paymentMethodId: string;
  },
): Promise<void> {
  await stripe.paymentMethods.attach(input.paymentMethodId, {
    customer: input.customerId,
  });
  await stripe.customers.update(input.customerId, {
    invoice_settings: { default_payment_method: input.paymentMethodId },
  });
  await stripe.subscriptions.update(input.subscriptionId, {
    default_payment_method: input.paymentMethodId,
  });
}

/**
 * Reads back a subscription's one price item id — `updateSubscriptionPrice`/
 * `previewPriceChangeInvoice` need it (Stripe swaps items by id, not by
 * subscription id alone), but this app never stores it at checkout time;
 * fetching it fresh here means it's always Stripe's actual current state,
 * not a potentially-stale cached copy. Every subscription this app
 * creates has exactly one price item — `null` (not thrown) if that's ever
 * not true, so the caller can fail closed rather than act on a guess.
 */
export async function getSubscriptionItemId(
  stripe: Stripe,
  subscriptionId: string,
): Promise<string | null> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];

  return item ? item.id : null;
}

export interface UpdateSubscriptionPriceResult {
  readonly status: string;
}

/**
 * Upgrade/downgrade: swaps the subscription's one price item for
 * another, with real proration (Stripe's own default when
 * proration_behavior is omitted — passed explicitly here for clarity,
 * matching this codebase's "explicit over implicit" convention). Requires
 * the subscription's current item id, since Stripe updates items by id,
 * not by subscription id alone.
 */
export async function updateSubscriptionPrice(
  stripe: Stripe,
  input: {
    subscriptionId: string;
    subscriptionItemId: string;
    newPriceId: string;
  },
): Promise<UpdateSubscriptionPriceResult> {
  const subscription = await stripe.subscriptions.update(input.subscriptionId, {
    items: [{ id: input.subscriptionItemId, price: input.newPriceId }],
    proration_behavior: "create_prorations",
  });

  return { status: subscription.status };
}

/**
 * Adds or updates the quantity of an add-on line item (a capacity SKU
 * like +5 active connections) on an existing subscription. Stripe
 * dedupes by price automatically when the item already exists on the
 * subscription — passing `price` without an `id` for a new item lets
 * Stripe create it; the caller is responsible for tracking the resulting
 * subscription item id afterward (see `packages/persistence`'s
 * `subscription-addons.ts`).
 */
export async function addSubscriptionAddonItem(
  stripe: Stripe,
  input: { subscriptionId: string; addonPriceId: string; quantity: number },
): Promise<{ subscriptionItemId: string }> {
  const subscription = await stripe.subscriptions.retrieve(
    input.subscriptionId,
  );

  const updated = await stripe.subscriptions.update(input.subscriptionId, {
    items: [
      ...subscription.items.data.map((item) => ({ id: item.id })),
      { price: input.addonPriceId, quantity: input.quantity },
    ],
    proration_behavior: "create_prorations",
  });

  const newItem = updated.items.data.find(
    (item) => item.price.id === input.addonPriceId,
  );

  if (!newItem) {
    throw new Error(
      "Stripe subscription update did not return the new add-on item",
    );
  }

  return { subscriptionItemId: newItem.id };
}

export async function removeSubscriptionAddonItem(
  stripe: Stripe,
  subscriptionItemId: string,
): Promise<void> {
  await stripe.subscriptionItems.del(subscriptionItemId, {
    proration_behavior: "create_prorations",
  });
}

/**
 * Customer-facing "Cancel" always means "keep access until the period
 * you already paid for ends" — the standard SaaS expectation, matching
 * `cancel_at_period_end` rather than an immediate `.cancel()`.
 */
export async function cancelSubscriptionAtPeriodEnd(
  stripe: Stripe,
  subscriptionId: string,
): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function resumeSubscription(
  stripe: Stripe,
  subscriptionId: string,
): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

export interface PreviewInvoiceResult {
  readonly amountDueCents: number;
  readonly currency: string;
}

/**
 * Shows a customer the real prorated amount before they confirm an
 * upgrade/downgrade — Stripe's create-preview-invoice endpoint, not an
 * estimate computed locally.
 */
export async function previewPriceChangeInvoice(
  stripe: Stripe,
  input: {
    customerId: string;
    subscriptionId: string;
    subscriptionItemId: string;
    newPriceId: string;
  },
): Promise<PreviewInvoiceResult> {
  const invoice = await stripe.invoices.createPreview({
    customer: input.customerId,
    subscription: input.subscriptionId,
    subscription_details: {
      items: [{ id: input.subscriptionItemId, price: input.newPriceId }],
    },
  });

  return {
    amountDueCents: invoice.amount_due,
    currency: invoice.currency,
  };
}

/**
 * Real webhook signature verification via Stripe's own SDK (HMAC with
 * timestamp-tolerance and timing-safe comparison) — never hand-rolled.
 * Takes an already-constructed client (`createStripeBillingClient`)
 * rather than a bare secret, since `constructEvent` is only exposed as an
 * instance method and this avoids constructing a second, throwaway
 * client just to reach it. Throws on an invalid signature; the caller
 * (the webhook Route Handler) is expected to catch and respond 400.
 */
export function constructStripeWebhookEvent(
  stripe: Stripe,
  rawBody: string | Buffer,
  signatureHeader: string,
  webhookSecret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    rawBody,
    signatureHeader,
    webhookSecret,
  );
}
