-- `insert into organizations (...) returning id` requires SELECT privilege
-- on the table in addition to INSERT (PostgreSQL checks RETURNING columns
-- against SELECT, not INSERT). 0009 granted identity_provisioner INSERT on
-- organizations but not SELECT, so provision_identity_and_organization's
-- second insert failed with "permission denied for table organizations".
grant select on table public.organizations to identity_provisioner;
