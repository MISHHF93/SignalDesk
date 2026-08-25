-- Real bug found by review: the Stripe webhook handler
-- (billing/webhooks/stripe/route.ts) applied every incoming event's
-- subscription snapshot unconditionally, with no check against delivery
-- order. Stripe explicitly does not guarantee webhook delivery order —
-- a delayed retry of a stale event (e.g. an old `invoice.payment_failed`
-- arriving after a newer `customer.subscription.updated` already
-- recorded `active`) could silently regress real subscription state back
-- to something Stripe itself had already superseded.
--
-- Purely additive: nullable, defaults to null (no prior sync recorded)
-- for every existing row, matching "no webhook has updated this row
-- through the new ordering-aware path yet" honestly rather than
-- fabricating a value. updateSubscriptionFromStripe
-- (packages/persistence/src/subscriptions.ts) is the only place that
-- reads or writes it.
alter table organization_subscriptions
  add column stripe_event_synced_at timestamptz;
