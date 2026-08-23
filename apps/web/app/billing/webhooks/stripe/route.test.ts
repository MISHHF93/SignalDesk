import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";

import {
  createDatabasePool,
  createOrganizationSubscription,
  getOrganizationSubscription,
  getPlanByKey,
  provisionIdentityAndOrganization,
  type DatabasePool,
} from "@signaldesk/persistence";

/**
 * Real duplicate-delivery/idempotency coverage for the Stripe billing
 * webhook (LAUNCH-BLOCKERS.md / SELF-HEALING-AUDIT.md Iteration 3's own
 * "next up" item — this app's first `apps/web` test). Stripe's own
 * delivery guarantee is best-effort and can redeliver the same event more
 * than once; this proves the real `POST` handler — signature verification,
 * event-type dispatch, and the underlying `updateSubscriptionFromStripe`
 * write — is safe to receive the identical event twice, not just that the
 * persistence-layer UPDATE is idempotent in isolation.
 *
 * `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are set to well-formed but
 * fake test values *before* importing the route: `createStripeBillingClient`
 * only constructs a local `Stripe` SDK instance (no network call), and
 * `constructStripeWebhookEvent` is a purely local HMAC verification against
 * whatever secret is configured — a real Stripe account is never needed to
 * exercise this route's own logic. The signed request bodies below are
 * generated with the real `stripe` SDK's own `webhooks.generateTestHeaderString`
 * (the same helper Stripe's own docs recommend for this), so the signature
 * this test produces is verified by the exact same code path a real Stripe
 * webhook delivery would go through.
 */
const STRIPE_SECRET_KEY = "sk_test_51_route_test_fake_key";
const STRIPE_WEBHOOK_SECRET = "whsec_route_test_fake_secret";

process.env.STRIPE_SECRET_KEY = STRIPE_SECRET_KEY;
process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_route_test_fake_key";

const { POST } = await import("./route");

const signingClient = new Stripe(STRIPE_SECRET_KEY);

function signedRequest(body: unknown): Request {
  const payload = JSON.stringify(body);
  const signature = signingClient.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
  });

  return new Request("http://localhost/billing/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  });
}

function subscriptionUpdatedEvent(input: {
  readonly stripeSubscriptionId: string;
  readonly stripeCustomerId: string;
  readonly status: string;
  readonly currentPeriodStart: number;
  readonly currentPeriodEnd: number;
}) {
  return {
    id: `evt_${randomUUID()}`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: input.stripeSubscriptionId,
        customer: input.stripeCustomerId,
        status: input.status,
        trial_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
        items: {
          data: [
            {
              current_period_start: input.currentPeriodStart,
              current_period_end: input.currentPeriodEnd,
            },
          ],
        },
      },
    },
  };
}

function invoicePaymentFailedEvent(stripeSubscriptionId: string) {
  return {
    id: `evt_${randomUUID()}`,
    type: "invoice.payment_failed",
    data: {
      object: {
        subscription: stripeSubscriptionId,
      },
    },
  };
}

describe.skipIf(!process.env.DATABASE_URL)(
  "Stripe billing webhook route (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = createDatabasePool();
    });

    afterAll(async () => {
      await pool.end();
    });

    async function seedSubscribedOrganization() {
      const { organizationId } = await provisionIdentityAndOrganization(pool, {
        identityProvider: "test",
        identityProviderSubject: `subject-${randomUUID()}`,
        displayName: `Route Test User ${randomUUID()}`,
        primaryEmail: `route-test-${randomUUID()}@example.com`,
      });
      const business = await getPlanByKey(pool, "business");
      const stripeSubscriptionId = `sub_test_${randomUUID()}`;
      const stripeCustomerId = `cus_test_${randomUUID()}`;

      await createOrganizationSubscription(pool, organizationId, {
        planId: business?.id as string,
        planPriceId: null,
        status: "trialing",
        stripeCustomerId,
        stripeSubscriptionId,
        stripeMode: "test",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

      return { organizationId, stripeSubscriptionId, stripeCustomerId };
    }

    it("rejects a request with an invalid signature", async () => {
      const request = new Request("http://localhost/billing/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=not-a-real-signature" },
        body: JSON.stringify({
          id: "evt_bad",
          type: "customer.subscription.updated",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("applies customer.subscription.updated and is a no-op-equivalent when the identical event is redelivered", async () => {
      const { organizationId, stripeSubscriptionId, stripeCustomerId } =
        await seedSubscribedOrganization();
      const periodStart = Math.floor(Date.now() / 1000);
      const periodEnd = periodStart + 30 * 24 * 60 * 60;
      const event = subscriptionUpdatedEvent({
        stripeSubscriptionId,
        stripeCustomerId,
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      const firstResponse = await POST(signedRequest(event));
      expect(firstResponse.status).toBe(200);
      expect(await firstResponse.json()).toEqual({ received: true });

      const afterFirst = await getOrganizationSubscription(
        pool,
        organizationId,
      );
      expect(afterFirst?.status).toBe("active");
      expect(afterFirst?.trialEndsAt).toBeNull();
      expect(afterFirst?.currentPeriodEnd?.getTime()).toBe(periodEnd * 1000);

      // Stripe redelivers the *exact same* event (its own documented
      // best-effort delivery guarantee) — a second identical delivery must
      // not error and must leave the subscription in the same real state,
      // not a corrupted or doubled one.
      const secondResponse = await POST(signedRequest(event));
      expect(secondResponse.status).toBe(200);
      expect(await secondResponse.json()).toEqual({ received: true });

      const afterSecond = await getOrganizationSubscription(
        pool,
        organizationId,
      );
      expect(afterSecond?.id).toBe(afterFirst?.id);
      expect(afterSecond?.status).toBe("active");
      expect(afterSecond?.currentPeriodEnd?.getTime()).toBe(periodEnd * 1000);
    });

    it("applies invoice.payment_failed and is safe when redelivered", async () => {
      const { organizationId, stripeSubscriptionId } =
        await seedSubscribedOrganization();
      const event = invoicePaymentFailedEvent(stripeSubscriptionId);

      const firstResponse = await POST(signedRequest(event));
      expect(firstResponse.status).toBe(200);

      const afterFirst = await getOrganizationSubscription(
        pool,
        organizationId,
      );
      expect(afterFirst?.status).toBe("past_due");

      const secondResponse = await POST(signedRequest(event));
      expect(secondResponse.status).toBe(200);

      const afterSecond = await getOrganizationSubscription(
        pool,
        organizationId,
      );
      expect(afterSecond?.status).toBe("past_due");
    });

    it("acknowledges an event for an unknown subscription without erroring", async () => {
      const event = subscriptionUpdatedEvent({
        stripeSubscriptionId: `sub_test_${randomUUID()}`,
        stripeCustomerId: `cus_test_${randomUUID()}`,
        status: "active",
        currentPeriodStart: Math.floor(Date.now() / 1000),
        currentPeriodEnd: Math.floor(Date.now() / 1000) + 2_592_000,
      });

      const response = await POST(signedRequest(event));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: true });
    });
  },
);
