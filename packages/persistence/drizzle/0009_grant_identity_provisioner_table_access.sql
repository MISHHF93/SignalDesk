-- SECURITY DEFINER + BYPASSRLS (0007) only bypasses row level security
-- policies; it does not grant ordinary table-level privileges, and
-- identity_provisioner owns none of these tables. Without these grants,
-- provision_identity_and_organization's inserts and
-- resolve_memberships_for_identity's reads both fail with
-- "permission denied for table ...".
grant insert on table public.users, public.organizations, public.memberships to identity_provisioner;
grant select on table public.users, public.memberships to identity_provisioner;
