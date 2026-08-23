-- Real bug caught by a live test: SECURITY DEFINER only runs the function
-- body with the owning role's privileges — it does not grant the table
-- access that role needs in the first place. identity_provisioner has
-- SELECT on organization_subscriptions (from 0025's resolver) but was
-- never granted SELECT on integrations, so
-- resolve_organization_and_integration_for_quickbooks_realm (0036) failed
-- with "permission denied for table integrations" the moment a live test
-- exercised it. BYPASSRLS (identity_provisioner's existing attribute)
-- bypasses row level security policies, not the underlying table grant —
-- both are required.

grant select on public.integrations to identity_provisioner;
