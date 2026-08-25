-- Real constraint, not just an index (found by review): the webhook
-- handler resolves an organization from a bare `where
-- stripe_subscription_id = $1` / `where stripe_customer_id = $1`
-- (`resolve_organization_for_stripe_subscription`/`_customer`,
-- 0025_resolve_organization_for_stripe_id.sql) with nothing at the DB
-- layer stopping two different organizations from ever ending up with
-- the same Stripe id — which would let a real Stripe event for one
-- tenant silently apply to whichever organization Postgres happens to
-- return first. Verified against both live databases before writing this
-- migration: no existing duplicate, non-null value in either column
-- today, so this is a safe, real constraint to add now rather than a
-- theoretical one that would already be violated.
--
-- Multiple NULLs (a subscription never linked to Stripe) remain allowed —
-- Postgres unique constraints never compare NULL to NULL as equal.
--
-- Drops the old plain indexes first: a UNIQUE constraint creates its own
-- backing index, so keeping the old ones too would just be a redundant,
-- unused duplicate index on the same column.
drop index if exists organization_subscriptions_stripe_subscription_id_index;
drop index if exists organization_subscriptions_stripe_customer_id_index;

alter table organization_subscriptions
  add constraint organization_subscriptions_stripe_subscription_id_unique
  unique (stripe_subscription_id);

alter table organization_subscriptions
  add constraint organization_subscriptions_stripe_customer_id_unique
  unique (stripe_customer_id);
