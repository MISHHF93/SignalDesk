-- Real bug caught by a live test, same class as drizzle/0037: SECURITY
-- DEFINER only runs the function body with the owning role's privileges —
-- it does not grant the table access that role needs in the first place.
-- identity_provisioner owns validate_organization_invite_token and
-- provision_identity_and_organization (0046) but was never granted
-- select/insert/update on organization_invites itself, so both failed
-- with "permission denied for table organization_invites" the moment a
-- live test exercised the invite-acceptance path.

-- select: validate_organization_invite_token reads it, and
-- provision_identity_and_organization looks up a matching pending invite.
-- update: provision_identity_and_organization marks it accepted. No
-- insert: creating an invite always goes through the normal tenant-scoped
-- app_runtime path (the real Server Action, RLS-checked), never through
-- this pre-tenant-context role — least privilege, not an oversight.
grant select, update on public.organization_invites to identity_provisioner;
