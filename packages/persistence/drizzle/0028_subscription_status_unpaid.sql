-- Stripe's real Subscription.status enum includes `unpaid` (reached when
-- charge_automatically has exhausted retries and the account's Smart
-- Retries settings are configured to mark unpaid rather than cancel) —
-- missing from the original allowed-status list, which would have
-- rejected a legitimate webhook-driven status update.
ALTER TABLE "organization_subscriptions" DROP CONSTRAINT "organization_subscriptions_status_allowed";--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_status_allowed" CHECK ("organization_subscriptions"."status" in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'paused', 'unpaid'));