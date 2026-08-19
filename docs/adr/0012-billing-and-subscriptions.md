# ADR 0012: Billing and subscriptions — Stripe as the paid-plan system of record

- Status: Accepted
- Date: 2026-08-19

## Context

The product had no way to charge anyone. Every plan, price, and entitlement was a marketing-page number, not a database row, and nothing gated a feature by what an organization had actually paid for. This decision covers the billing foundation built to close that: real plans and prices, real Stripe subscriptions, and real entitlement enforcement — deliberately not a general-purpose billing platform.

## Decision

**Stripe is the payment processor and the subscription state machine; this app's database is the read-optimized mirror.** `plans`, `plan_prices`, `plan_addons`, and `plan_entitlements` (migration 0022) are this app's own catalog — Stripe never sees plan names or entitlement grants, only price ids. `organization_subscriptions` mirrors exactly one Stripe Subscription per organization (`organization_subscriptions_org_unique`, migration 0022) with `status`, `stripe_subscription_id`, `stripe_customer_id`, `plan_price_id`, and period/trial bounds.

**Checkout uses PaymentIntents via the embedded Payment Element, not Stripe Checkout's hosted page.** `createSubscriptionWithImmediatePayment` creates the subscription with `payment_behavior: "default_incomplete"` and returns the invoice's `confirmation_secret.client_secret` (the current Stripe API field — verified against `docs.stripe.com`, not assumed from training data, which still shows the older `payment_intent.client_secret` pattern in some contexts) for `@stripe/react-stripe-js`'s Payment Element to confirm client-side. This keeps checkout on this app's own domain end to end.

**Every mutating billing Server Action calls Stripe directly, then syncs the local row immediately** — `updateSubscriptionFromStripe` runs right after every real Stripe API call in `start-checkout`, `cancel-subscription`, `resume-subscription`, and `change-plan`, rather than waiting for the webhook. The webhook (`billing/webhooks/stripe`) remains the authoritative long-term sync point for everything this app didn't just initiate itself (Stripe-side retries, disputes, an admin editing a subscription in the Stripe dashboard) — this is a latency optimization on top of the webhook, not a replacement for it.

**Entitlement is granted only for `trialing`, `active`, and `past_due`.** `getEntitlementUsage`/`canAddActiveConnection` join `organization_subscriptions` to `plan_entitlements` with an explicit status allowlist — every other status (`canceled`, `incomplete`, `incomplete_expired`, `unpaid`, `paused`) falls through to the "no subscription" honest-zero branch. `past_due` deliberately still counts: it is Stripe's payment-retry grace period, not an instant cutoff for one failed charge. This closed a real bug found during the launch-readiness audit — the original query had no status filter at all, so a canceled subscription's row kept granting full plan access forever.

**Never call the raw Stripe SDK from `apps/web`.** Every Stripe operation is a named, unit-tested function in `packages/integrations/src/stripe-billing/client.ts` (`createStripeCustomer`, `createSubscriptionWithImmediatePayment`, `cancelSubscriptionAtPeriodEnd`, `resumeSubscription`, `updateSubscriptionPrice`, `addSubscriptionAddonItem`, `retrieveIncompleteSubscriptionClientSecret`, and others), tested against a `fakeStripe(overrides)` mock. Server Actions in `apps/web` compose these; they never import `stripe` directly.

**A subscription's Stripe subscription-item id and billing interval are never persisted redundantly.** `getSubscriptionItemId` fetches the item id fresh from Stripe whenever an upgrade/downgrade/add-on change needs it. `change-plan`'s `resolveTargetPrice` resolves the org's _current_ interval via `getPlanPriceById(subscription.planPriceId)` before resolving the new plan's price at that same interval, so a plan change never silently also flips monthly/annual billing. Both choices avoid a schema migration and avoid touching the already-tested checkout path.

**Resubscribing after cancellation resurrects the same row rather than inserting a second one.** `organization_subscriptions_org_unique` is a permanent one-row-per-organization constraint, so `resurrectOrganizationSubscription` UPDATEs the existing row in place — new Stripe customer, new Stripe subscription, every field replaced, `cancel_at_period_end`/`canceled_at` explicitly reset — guarded at the database level to only match rows currently `canceled`/`incomplete_expired`. `start-checkout.ts` and the checkout page's blocking notice both key off the same `RESUBSCRIBABLE_STATUSES` set so a customer whose subscription has fully ended sees a normal checkout flow, not "contact support." This was chosen over allowing multiple historical rows per organization (more flexible, but a real migration plus updated query logic everywhere a single row is assumed) because Stripe itself already retains the full subscription history — this app's local row only needs to reflect the current one.

## Explicitly out of scope

A Stripe catalog sync script (today's `plan_prices` rows are hand-seeded via migration 0023, not synced from Stripe's product catalog). Usage-based/metered billing. Multiple subscriptions per organization — deliberately, see the resurrection decision above. Team-level or per-seat billing beyond the flat `usersLimit`/`activeConnectionsLimit` entitlement pair. Dunning emails or a retry-schedule beyond Stripe's own Smart Retries. A local audit trail of past subscription periods (Stripe's dashboard is the historical record; this app's local row is current-state-only).

## Consequences

Billing behavior is exactly as reliable as Stripe's own webhook delivery plus this app's direct-sync-on-action pattern — no local retry queue exists if both the direct sync and the webhook fail on the same event. The entitlement status allowlist is the one piece of this system enforcing revenue integrity; any new subscription status Stripe introduces (this ADR already had to add `unpaid` retroactively — migration 0028) needs the same deliberate allow/deny judgment call, not a reflexive "add it to the CHECK constraint and move on."
