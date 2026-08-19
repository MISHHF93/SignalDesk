-- Real bug caught by a live test: organization_subscriptions has FORCE
-- ROW LEVEL SECURITY, so a plain app_runtime query with no tenant context
-- set returns zero rows for every id, not "all rows" — the webhook
-- handler needs to resolve which organization owns a Stripe subscription/
-- customer id *before* it has any tenant context to set (that's the whole
-- point of the lookup). This is the identical bootstrapping problem
-- `resolve_memberships_for_identity` (0007) already solves for sign-in —
-- same fix: a narrow SECURITY DEFINER function owned by the existing
-- identity_provisioner role (NOLOGIN, BYPASSRLS), never a blanket RLS
-- bypass. Reused rather than duplicated into a new role, since the
-- justification is exactly the same category of problem.

create or replace function public.resolve_organization_for_stripe_subscription(p_stripe_subscription_id text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select organization_id
  from public.organization_subscriptions
  where stripe_subscription_id = p_stripe_subscription_id;
$function$;

alter function public.resolve_organization_for_stripe_subscription(text) owner to identity_provisioner;
revoke execute on function public.resolve_organization_for_stripe_subscription(text) from public, anon, authenticated;
grant execute on function public.resolve_organization_for_stripe_subscription(text) to app_runtime;

create or replace function public.resolve_organization_for_stripe_customer(p_stripe_customer_id text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select organization_id
  from public.organization_subscriptions
  where stripe_customer_id = p_stripe_customer_id;
$function$;

alter function public.resolve_organization_for_stripe_customer(text) owner to identity_provisioner;
revoke execute on function public.resolve_organization_for_stripe_customer(text) from public, anon, authenticated;
grant execute on function public.resolve_organization_for_stripe_customer(text) to app_runtime;
