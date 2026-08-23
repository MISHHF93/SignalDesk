-- LAUNCH-BLOCKERS.md P1 #8: a real billing state reconciliation sweep.
-- Stripe is the source of truth for subscription state
-- (`updateSubscriptionFromStripe`'s own doc comment); today the only path
-- that keeps `organization_subscriptions` in sync with it is the webhook
-- handler, which is best-effort delivery per Stripe's own documented
-- guarantees — a missed or out-of-order webhook silently leaves a local
-- row stale (e.g. a canceled-at-Stripe subscription still showing
-- `active` locally, which would wrongly keep granting entitlements). A
-- scheduled sweep needs to read every org's Stripe-linked subscription
-- state across tenants to compare it against Stripe's own API, which is
-- exactly the same class of legitimate cross-tenant read
-- `list_active_organization_ids` (migration 0055b) already established a
-- narrow, deliberate exception for — this reuses that same
-- `scheduled_job_runner` role rather than inventing a second one.
--
-- Scoped as narrowly as 0055b: select only the specific columns this
-- function needs (never `select *`), a single additional permissive
-- policy granted to `scheduled_job_runner` alone (never to `app_runtime`
-- directly), and a function that returns only the columns needed to
-- compare against Stripe and re-resolve which organization to correct —
-- no plan/pricing columns, since the sweep only ever corrects
-- Stripe-mirrored status/date fields (matching what
-- `updateSubscriptionFromStripe` already accepts from the webhook path),
-- never plan assignment.

grant select (
  organization_id,
  stripe_subscription_id,
  stripe_customer_id,
  status,
  trial_ends_at,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  canceled_at
) on table public.organization_subscriptions to scheduled_job_runner;

drop policy if exists organization_subscriptions_scheduled_job_read on public.organization_subscriptions;
create policy organization_subscriptions_scheduled_job_read on public.organization_subscriptions
  for select
  to scheduled_job_runner
  using (true);

create or replace function public.list_stripe_linked_subscriptions()
returns table (
  organization_id uuid,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  canceled_at timestamptz
)
security definer
set search_path = ''
language sql
as $function$
  select
    organization_id,
    stripe_subscription_id,
    stripe_customer_id,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    canceled_at
  from public.organization_subscriptions
  where stripe_subscription_id is not null;
$function$;

alter function public.list_stripe_linked_subscriptions() owner to scheduled_job_runner;

grant execute on function public.list_stripe_linked_subscriptions() to app_runtime;
