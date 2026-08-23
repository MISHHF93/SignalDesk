import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

import {
  mapStripeSubscriptionToSyncFields,
  retrieveRawSubscription,
  type RawStripeSubscription,
} from "./subscription-sync";

function fakeStripe(overrides: Record<string, unknown>): Stripe {
  return overrides as unknown as Stripe;
}

function rawSubscription(
  overrides: Partial<RawStripeSubscription> = {},
): RawStripeSubscription {
  return {
    id: "sub_test",
    customer: "cus_test",
    status: "active",
    trial_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    items: {
      data: [
        {
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
        },
      ],
    },
    ...overrides,
  };
}

describe("mapStripeSubscriptionToSyncFields", () => {
  it("converts unix timestamps to Dates and carries status/flags through", () => {
    const fields = mapStripeSubscriptionToSyncFields(
      rawSubscription({ status: "past_due", trial_end: 1_700_500_000 }),
    );

    expect(fields.status).toBe("past_due");
    expect(fields.trialEndsAt?.getTime()).toBe(1_700_500_000 * 1000);
    expect(fields.currentPeriodStart?.getTime()).toBe(1_700_000_000 * 1000);
    expect(fields.currentPeriodEnd?.getTime()).toBe(1_702_592_000 * 1000);
    expect(fields.cancelAtPeriodEnd).toBe(false);
    expect(fields.canceledAt).toBeNull();
  });

  it("reads period dates off the first line item, not a subscription-level field", () => {
    const fields = mapStripeSubscriptionToSyncFields(
      rawSubscription({
        items: {
          data: [
            {
              current_period_start: 1_690_000_000,
              current_period_end: 1_692_592_000,
            },
            {
              current_period_start: 1_600_000_000,
              current_period_end: 1_602_592_000,
            },
          ],
        },
      }),
    );

    expect(fields.currentPeriodStart?.getTime()).toBe(1_690_000_000 * 1000);
    expect(fields.currentPeriodEnd?.getTime()).toBe(1_692_592_000 * 1000);
  });

  it("falls back to null period dates when there is no line item", () => {
    const fields = mapStripeSubscriptionToSyncFields(
      rawSubscription({ items: { data: [] } }),
    );

    expect(fields.currentPeriodStart).toBeNull();
    expect(fields.currentPeriodEnd).toBeNull();
  });

  it("maps a canceled subscription's cancellation timestamp through", () => {
    const fields = mapStripeSubscriptionToSyncFields(
      rawSubscription({
        status: "canceled",
        cancel_at_period_end: false,
        canceled_at: 1_701_000_000,
      }),
    );

    expect(fields.status).toBe("canceled");
    expect(fields.canceledAt?.getTime()).toBe(1_701_000_000 * 1000);
  });
});

describe("retrieveRawSubscription", () => {
  it("retrieves the subscription by id and returns it as the raw sync shape", async () => {
    const stripeSubscription = {
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
      items: { data: [{ current_period_start: 1, current_period_end: 2 }] },
    };
    const retrieve = vi.fn().mockResolvedValue(stripeSubscription);
    const stripe = fakeStripe({ subscriptions: { retrieve } });

    const result = await retrieveRawSubscription(stripe, "sub_123");

    expect(retrieve).toHaveBeenCalledWith("sub_123");
    expect(result).toEqual(stripeSubscription);
  });
});
