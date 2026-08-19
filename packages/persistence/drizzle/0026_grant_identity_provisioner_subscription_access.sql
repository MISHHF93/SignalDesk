-- Same bug 0009 already documents for identity_provisioner: SECURITY
-- DEFINER + BYPASSRLS bypasses row level security, but never grants
-- ordinary table-level privileges. Without this,
-- resolve_organization_for_stripe_subscription/_customer (0025) both fail
-- with "permission denied for table organization_subscriptions" — caught
-- by a live test, not assumed.
grant select on table public.organization_subscriptions to identity_provisioner;
