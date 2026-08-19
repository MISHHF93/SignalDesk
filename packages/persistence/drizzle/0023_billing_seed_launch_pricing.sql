-- Launch pricing hypothesis, per the user's explicit spec (not invented):
-- Starter $49/mo or $490/yr (5 users, 5 active connections), Business
-- $129/mo or $1,290/yr — recommended (15 users, 15 active connections),
-- Scale $299/mo or $2,990/yr (40 users, 40 active connections), Enterprise
-- negotiated (no fixed price, no self-serve checkout). 14-day Business
-- trial, no card required, no permanent Free plan. Two optional capacity
-- add-ons at $20/month each, toggleable via plan_addons.is_enabled. A
-- Founding Business promotional price ($79/mo) is seeded but left
-- open-ended (promo_ends_at is null) — the user described "a defined/
-- locked period" as a requirement the *schema* must support, not a real
-- cutoff date to invent here. Set promo_ends_at (or flip
-- is_active_for_new_checkouts to false) once the actual cohort window is
-- decided.
--
-- No Stripe price IDs are set here — those are populated by running the
-- sync script once real Stripe credentials exist (see
-- packages/integrations/src/stripe-billing/sync-catalog.ts), the same
-- "code is real, credentials are the only gap" pattern as every connector.

insert into public.plans (plan_key, name, tier_order, is_recommended, is_custom_pricing, supports_self_serve_checkout, differentiation_summary)
values
  ('starter', 'Starter', 1, false, false, true,
   'Visibility and core intelligence across every connected system.'),
  ('business', 'Business', 2, true, false, true,
   'Full cross-system intelligence, action preparation, and approvals.'),
  ('scale', 'Scale', 3, false, false, true,
   'Advanced policies, delegated automation, and greater capacity and governance.'),
  ('enterprise', 'Enterprise', 4, false, true, false,
   'Enterprise identity, security, governance, custom connectors, and negotiated capacity.');
--> statement-breakpoint

insert into public.plan_prices (plan_id, billing_interval, amount_cents, currency)
select id, 'month', 4900, 'usd' from public.plans where plan_key = 'starter'
union all
select id, 'year', 49000, 'usd' from public.plans where plan_key = 'starter'
union all
select id, 'month', 12900, 'usd' from public.plans where plan_key = 'business'
union all
select id, 'year', 129000, 'usd' from public.plans where plan_key = 'business'
union all
select id, 'month', 29900, 'usd' from public.plans where plan_key = 'scale'
union all
select id, 'year', 299000, 'usd' from public.plans where plan_key = 'scale';
--> statement-breakpoint

-- Founding Business promotional price: a locked-period variant of the
-- Business plan_key, not a separate permanent tier.
insert into public.plan_prices (plan_id, billing_interval, amount_cents, currency, price_kind, promo_key, promo_starts_at)
select id, 'month', 7900, 'usd', 'promotional', 'founding-business-79', now()
from public.plans where plan_key = 'business';
--> statement-breakpoint

insert into public.plan_entitlements (plan_id, included_users, included_active_connections, capability_flags)
select id, 5, 5, '{
  "actionPreparation": false,
  "approvals": false,
  "delegatedAutomation": false,
  "advancedPolicies": false,
  "governanceControls": false,
  "enterpriseIdentity": false,
  "customConnectors": false
}'::jsonb
from public.plans where plan_key = 'starter'
union all
select id, 15, 15, '{
  "actionPreparation": true,
  "approvals": true,
  "delegatedAutomation": false,
  "advancedPolicies": false,
  "governanceControls": false,
  "enterpriseIdentity": false,
  "customConnectors": false
}'::jsonb
from public.plans where plan_key = 'business'
union all
select id, 40, 40, '{
  "actionPreparation": true,
  "approvals": true,
  "delegatedAutomation": true,
  "advancedPolicies": true,
  "governanceControls": true,
  "enterpriseIdentity": false,
  "customConnectors": false
}'::jsonb
from public.plans where plan_key = 'scale'
union all
select id, null, null, '{
  "actionPreparation": true,
  "approvals": true,
  "delegatedAutomation": true,
  "advancedPolicies": true,
  "governanceControls": true,
  "enterpriseIdentity": true,
  "customConnectors": true
}'::jsonb
from public.plans where plan_key = 'enterprise';
--> statement-breakpoint

insert into public.plan_addons (addon_key, name, grants_active_connections, grants_users, amount_cents, billing_interval, is_enabled)
values
  ('extra_5_connections', '+5 active connections', 5, 0, 2000, 'month', true),
  ('extra_10_users', '+10 users', 0, 10, 2000, 'month', true);
