import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

// Only `createStripeBillingClient` ever calls `new Stripe(...)` — every
// other function under test receives a pre-built client via `fakeStripe`,
// so mocking the constructor here cannot affect any other test in this
// file.
const stripeConstructorMock = vi.fn();

vi.mock("stripe", () => {
  class MockStripe {
    constructor(...args: unknown[]) {
      stripeConstructorMock(...args);
    }
  }
  return { default: MockStripe };
});

const {
  addSubscriptionAddonItem,
  attachDefaultPaymentMethod,
  cancelOrphanedSubscription,
  cancelSubscriptionAtPeriodEnd,
  constructStripeWebhookEvent,
  createSetupIntentForCustomer,
  createStripeBillingClient,
  createStripeCustomer,
  createSubscriptionWithImmediatePayment,
  createTrialSubscription,
  getSubscriptionItemId,
  previewPriceChangeInvoice,
  removeSubscriptionAddonItem,
  resumeSubscription,
  retrieveIncompleteSubscriptionClientSecret,
  retrieveSetupIntentPaymentMethod,
  updateSubscriptionPrice,
} = await import("./client");

/** A minimal stand-in for the Stripe SDK client, typed loosely enough to
 * avoid re-declaring the entire real interface — each test wires up only
 * the methods it exercises. */
function fakeStripe(overrides: Record<string, unknown>): Stripe {
  return overrides as unknown as Stripe;
}

describe("createStripeBillingClient", () => {
  it("configures automatic network retries, unlike the Stripe SDK's zero-retry default", () => {
    createStripeBillingClient("sk_test_123");

    expect(stripeConstructorMock).toHaveBeenCalledWith("sk_test_123", {
      maxNetworkRetries: 3,
    });
  });
});

describe("createStripeCustomer", () => {
  it("creates a customer with organizationId in metadata", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cus_123" });
    const stripe = fakeStripe({ customers: { create } });

    const customer = await createStripeCustomer(stripe, {
      email: "alex@example.test",
      name: "Alex Rivera",
      organizationId: "org_1",
    });

    expect(customer).toEqual({ id: "cus_123" });
    expect(create).toHaveBeenCalledWith({
      email: "alex@example.test",
      name: "Alex Rivera",
      metadata: { organizationId: "org_1" },
    });
  });

  it("omits name entirely when not provided, rather than sending undefined", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cus_123" });
    const stripe = fakeStripe({ customers: { create } });

    await createStripeCustomer(stripe, {
      email: "alex@example.test",
      organizationId: "org_1",
    });

    expect(create).toHaveBeenCalledWith({
      email: "alex@example.test",
      metadata: { organizationId: "org_1" },
    });
  });
});

describe("createTrialSubscription", () => {
  it("creates a trial subscription with no payment method and cancel-on-missing-payment behavior", async () => {
    const trialEndUnix = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
    const create = vi.fn().mockResolvedValue({
      id: "sub_123",
      status: "trialing",
      trial_end: trialEndUnix,
    });
    const stripe = fakeStripe({ subscriptions: { create } });

    const result = await createTrialSubscription(stripe, {
      customerId: "cus_123",
      priceId: "price_business_monthly",
      trialDays: 14,
    });

    expect(result).toEqual({
      subscriptionId: "sub_123",
      status: "trialing",
      trialEndsAt: new Date(trialEndUnix * 1000),
    });
    expect(create).toHaveBeenCalledWith({
      customer: "cus_123",
      items: [{ price: "price_business_monthly" }],
      trial_period_days: 14,
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    });
  });

  it("returns a null trialEndsAt when Stripe doesn't report one", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "sub_123",
      status: "trialing",
      trial_end: null,
    });
    const stripe = fakeStripe({ subscriptions: { create } });

    const result = await createTrialSubscription(stripe, {
      customerId: "cus_123",
      priceId: "price_1",
      trialDays: 14,
    });

    expect(result.trialEndsAt).toBeNull();
  });
});

describe("createSubscriptionWithImmediatePayment", () => {
  it("extracts the confirmation_secret client_secret for the Payment Element", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "sub_456",
      status: "incomplete",
      latest_invoice: {
        confirmation_secret: { client_secret: "pi_123_secret_abc" }, // gitleaks:allow — fake test fixture, not a real Stripe secret
      },
    });
    const stripe = fakeStripe({ subscriptions: { create } });

    const result = await createSubscriptionWithImmediatePayment(stripe, {
      customerId: "cus_123",
      priceId: "price_starter_monthly",
    });

    expect(result).toEqual({
      subscriptionId: "sub_456",
      status: "incomplete",
      clientSecret: "pi_123_secret_abc", // gitleaks:allow — fake test fixture, not a real Stripe secret
    });
    expect(create).toHaveBeenCalledWith({
      customer: "cus_123",
      items: [{ price: "price_starter_monthly" }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.confirmation_secret"],
    });
  });

  it("throws when the invoice wasn't expanded", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "sub_456",
      status: "incomplete",
      latest_invoice: "in_not_expanded",
    });
    const stripe = fakeStripe({ subscriptions: { create } });

    await expect(
      createSubscriptionWithImmediatePayment(stripe, {
        customerId: "cus_123",
        priceId: "price_1",
      }),
    ).rejects.toThrow(/expanded invoice/);
  });

  it("throws when confirmation_secret is missing from the response", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "sub_456",
      status: "incomplete",
      latest_invoice: {},
    });
    const stripe = fakeStripe({ subscriptions: { create } });

    await expect(
      createSubscriptionWithImmediatePayment(stripe, {
        customerId: "cus_123",
        priceId: "price_1",
      }),
    ).rejects.toThrow(/confirmation_secret/);
  });
});

describe("retrieveIncompleteSubscriptionClientSecret", () => {
  it("extracts the confirmation_secret client_secret to retry payment", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: "sub_456",
      status: "incomplete",
      latest_invoice: {
        confirmation_secret: { client_secret: "pi_123_secret_abc" }, // gitleaks:allow — fake test fixture, not a real Stripe secret
      },
    });
    const stripe = fakeStripe({ subscriptions: { retrieve } });

    const clientSecret = await retrieveIncompleteSubscriptionClientSecret(
      stripe,
      "sub_456",
    );

    expect(clientSecret).toBe("pi_123_secret_abc");
    expect(retrieve).toHaveBeenCalledWith("sub_456", {
      expand: ["latest_invoice.confirmation_secret"],
    });
  });

  it("returns null when the invoice wasn't expanded", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: "sub_456",
      status: "incomplete",
      latest_invoice: "in_not_expanded",
    });
    const stripe = fakeStripe({ subscriptions: { retrieve } });

    const clientSecret = await retrieveIncompleteSubscriptionClientSecret(
      stripe,
      "sub_456",
    );

    expect(clientSecret).toBeNull();
  });

  it("returns null when there's no confirmation_secret to confirm", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: "sub_456",
      status: "incomplete",
      latest_invoice: {},
    });
    const stripe = fakeStripe({ subscriptions: { retrieve } });

    const clientSecret = await retrieveIncompleteSubscriptionClientSecret(
      stripe,
      "sub_456",
    );

    expect(clientSecret).toBeNull();
  });
});

describe("createSetupIntentForCustomer", () => {
  it("returns the client secret for a card SetupIntent", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ client_secret: "seti_123_secret_abc" });
    const stripe = fakeStripe({ setupIntents: { create } });

    const result = await createSetupIntentForCustomer(stripe, "cus_123");

    expect(result).toEqual({ clientSecret: "seti_123_secret_abc" });
    expect(create).toHaveBeenCalledWith({
      customer: "cus_123",
      payment_method_types: ["card"],
    });
  });

  it("throws when Stripe returns no client_secret", async () => {
    const create = vi.fn().mockResolvedValue({ client_secret: null });
    const stripe = fakeStripe({ setupIntents: { create } });

    await expect(
      createSetupIntentForCustomer(stripe, "cus_123"),
    ).rejects.toThrow(/client_secret/);
  });
});

describe("retrieveSetupIntentPaymentMethod", () => {
  it("returns the payment method id from a completed SetupIntent belonging to the expected customer", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      payment_method: "pm_123",
      customer: "cus_real",
    });
    const stripe = fakeStripe({ setupIntents: { retrieve } });

    const paymentMethodId = await retrieveSetupIntentPaymentMethod(
      stripe,
      "seti_123",
      "cus_real",
    );

    expect(paymentMethodId).toBe("pm_123");
    expect(retrieve).toHaveBeenCalledWith("seti_123");
  });

  it("returns null when the SetupIntent has no payment method yet", async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValue({ payment_method: null, customer: "cus_real" });
    const stripe = fakeStripe({ setupIntents: { retrieve } });

    const paymentMethodId = await retrieveSetupIntentPaymentMethod(
      stripe,
      "seti_123",
      "cus_real",
    );

    expect(paymentMethodId).toBeNull();
  });

  it("returns null when payment_method is an expanded object rather than an id string", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      payment_method: { id: "pm_123" },
      customer: "cus_real",
    });
    const stripe = fakeStripe({ setupIntents: { retrieve } });

    const paymentMethodId = await retrieveSetupIntentPaymentMethod(
      stripe,
      "seti_123",
      "cus_real",
    );

    expect(paymentMethodId).toBeNull();
  });

  it("refuses a SetupIntent that belongs to a different customer — the cross-tenant guard", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      payment_method: "pm_123",
      customer: "cus_someone_else",
    });
    const stripe = fakeStripe({ setupIntents: { retrieve } });

    const paymentMethodId = await retrieveSetupIntentPaymentMethod(
      stripe,
      "seti_123",
      "cus_real",
    );

    expect(paymentMethodId).toBeNull();
  });

  it("refuses a SetupIntent with an expanded customer object that doesn't match", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      payment_method: "pm_123",
      customer: { id: "cus_someone_else" },
    });
    const stripe = fakeStripe({ setupIntents: { retrieve } });

    const paymentMethodId = await retrieveSetupIntentPaymentMethod(
      stripe,
      "seti_123",
      "cus_real",
    );

    expect(paymentMethodId).toBeNull();
  });

  it("refuses a SetupIntent with no customer at all", async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValue({ payment_method: "pm_123", customer: null });
    const stripe = fakeStripe({ setupIntents: { retrieve } });

    const paymentMethodId = await retrieveSetupIntentPaymentMethod(
      stripe,
      "seti_123",
      "cus_real",
    );

    expect(paymentMethodId).toBeNull();
  });
});

describe("attachDefaultPaymentMethod", () => {
  it("attaches the payment method and sets it as default on both customer and subscription", async () => {
    const attach = vi.fn().mockResolvedValue({});
    const customersUpdate = vi.fn().mockResolvedValue({});
    const subscriptionsUpdate = vi.fn().mockResolvedValue({});
    const stripe = fakeStripe({
      paymentMethods: { attach },
      customers: { update: customersUpdate },
      subscriptions: { update: subscriptionsUpdate },
    });

    await attachDefaultPaymentMethod(stripe, {
      customerId: "cus_123",
      subscriptionId: "sub_123",
      paymentMethodId: "pm_123",
    });

    expect(attach).toHaveBeenCalledWith("pm_123", { customer: "cus_123" });
    expect(customersUpdate).toHaveBeenCalledWith("cus_123", {
      invoice_settings: { default_payment_method: "pm_123" },
    });
    expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
      default_payment_method: "pm_123",
    });
  });
});

describe("getSubscriptionItemId", () => {
  it("returns the id of the subscription's one price item", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      items: { data: [{ id: "si_123" }] },
    });
    const stripe = fakeStripe({ subscriptions: { retrieve } });

    const itemId = await getSubscriptionItemId(stripe, "sub_123");

    expect(itemId).toBe("si_123");
    expect(retrieve).toHaveBeenCalledWith("sub_123");
  });

  it("returns null when the subscription has no items", async () => {
    const retrieve = vi.fn().mockResolvedValue({ items: { data: [] } });
    const stripe = fakeStripe({ subscriptions: { retrieve } });

    const itemId = await getSubscriptionItemId(stripe, "sub_123");

    expect(itemId).toBeNull();
  });
});

describe("updateSubscriptionPrice", () => {
  it("swaps the price with real proration", async () => {
    const update = vi.fn().mockResolvedValue({ status: "active" });
    const stripe = fakeStripe({ subscriptions: { update } });

    const result = await updateSubscriptionPrice(stripe, {
      subscriptionId: "sub_123",
      subscriptionItemId: "si_123",
      newPriceId: "price_scale_monthly",
    });

    expect(result).toEqual({ status: "active" });
    expect(update).toHaveBeenCalledWith("sub_123", {
      items: [{ id: "si_123", price: "price_scale_monthly" }],
      proration_behavior: "create_prorations",
    });
  });
});

describe("addSubscriptionAddonItem", () => {
  it("preserves existing items and appends the new add-on price", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      items: { data: [{ id: "si_existing" }] },
    });
    const update = vi.fn().mockResolvedValue({
      items: {
        data: [
          { id: "si_existing", price: { id: "price_base" } },
          { id: "si_new_addon", price: { id: "price_addon_connections" } },
        ],
      },
    });
    const stripe = fakeStripe({ subscriptions: { retrieve, update } });

    const result = await addSubscriptionAddonItem(stripe, {
      subscriptionId: "sub_123",
      addonPriceId: "price_addon_connections",
      quantity: 1,
    });

    expect(result).toEqual({ subscriptionItemId: "si_new_addon" });
    expect(update).toHaveBeenCalledWith("sub_123", {
      items: [
        { id: "si_existing" },
        { price: "price_addon_connections", quantity: 1 },
      ],
      proration_behavior: "create_prorations",
    });
  });

  it("throws when the new item can't be found in the update response", async () => {
    const retrieve = vi.fn().mockResolvedValue({ items: { data: [] } });
    const update = vi.fn().mockResolvedValue({ items: { data: [] } });
    const stripe = fakeStripe({ subscriptions: { retrieve, update } });

    await expect(
      addSubscriptionAddonItem(stripe, {
        subscriptionId: "sub_123",
        addonPriceId: "price_addon_connections",
        quantity: 1,
      }),
    ).rejects.toThrow(/new add-on item/);
  });
});

describe("removeSubscriptionAddonItem", () => {
  it("deletes the subscription item with proration", async () => {
    const del = vi.fn().mockResolvedValue({});
    const stripe = fakeStripe({ subscriptionItems: { del } });

    await removeSubscriptionAddonItem(stripe, "si_addon");

    expect(del).toHaveBeenCalledWith("si_addon", {
      proration_behavior: "create_prorations",
    });
  });
});

describe("cancelSubscriptionAtPeriodEnd / resumeSubscription", () => {
  it("sets cancel_at_period_end true, then false to resume", async () => {
    const update = vi.fn().mockResolvedValue({});
    const stripe = fakeStripe({ subscriptions: { update } });

    await cancelSubscriptionAtPeriodEnd(stripe, "sub_123");
    expect(update).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: true,
    });

    await resumeSubscription(stripe, "sub_123");
    expect(update).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: false,
    });
  });
});

describe("cancelOrphanedSubscription", () => {
  it("cancels immediately, unlike cancelSubscriptionAtPeriodEnd", async () => {
    const cancel = vi.fn().mockResolvedValue({});
    const stripe = fakeStripe({ subscriptions: { cancel } });

    await cancelOrphanedSubscription(stripe, "sub_orphan_123");

    expect(cancel).toHaveBeenCalledWith("sub_orphan_123");
  });
});

describe("previewPriceChangeInvoice", () => {
  it("returns the real prorated amount due", async () => {
    const createPreview = vi
      .fn()
      .mockResolvedValue({ amount_due: 8500, currency: "usd" });
    const stripe = fakeStripe({ invoices: { createPreview } });

    const result = await previewPriceChangeInvoice(stripe, {
      customerId: "cus_123",
      subscriptionId: "sub_123",
      subscriptionItemId: "si_123",
      newPriceId: "price_scale_monthly",
    });

    expect(result).toEqual({ amountDueCents: 8500, currency: "usd" });
  });
});

describe("constructStripeWebhookEvent", () => {
  it("delegates to stripe.webhooks.constructEvent", () => {
    const fakeEvent = { id: "evt_123", type: "customer.subscription.updated" };
    const constructEvent = vi.fn().mockReturnValue(fakeEvent);
    const stripe = fakeStripe({ webhooks: { constructEvent } });

    const event = constructStripeWebhookEvent(
      stripe,
      "raw-body",
      "sig-header",
      "whsec_test",
    );

    expect(event).toBe(fakeEvent);
    expect(constructEvent).toHaveBeenCalledWith(
      "raw-body",
      "sig-header",
      "whsec_test",
    );
  });

  it("propagates a signature verification failure", () => {
    const constructEvent = vi.fn().mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const stripe = fakeStripe({ webhooks: { constructEvent } });

    expect(() =>
      constructStripeWebhookEvent(stripe, "raw-body", "bad-sig", "whsec_test"),
    ).toThrow(/signatures/);
  });
});
