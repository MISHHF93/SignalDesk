-- Real identity provisioning (ADR 0005). Solves two bootstrapping problems
-- the fail-closed RLS model in 0001/0003 deliberately left open:
--   1. There is no INSERT policy for `users` at all ("Identity provisioning
--      requires a separately reviewed role" — 0001's own comment).
--   2. Resolving which organization an identity belongs to needs to happen
--      BEFORE any tenant context exists, which no ordinary RLS-scoped role
--      can do.
--
-- Both are solved by one narrow, NOLOGIN, BYPASSRLS role that owns exactly
-- two SECURITY DEFINER functions and nothing else. app_runtime is granted
-- EXECUTE on the functions only — never direct INSERT/SELECT on `users`.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'identity_provisioner') then
    create role identity_provisioner nologin nosuperuser bypassrls nocreatedb nocreaterole noreplication;
  end if;
end
$$;

-- The migration runner's role must be a member of identity_provisioner to
-- reassign ownership of the functions below (ALTER ... OWNER TO requires
-- membership in the target role, which CREATE ROLE alone does not grant).
grant identity_provisioner to current_user;

-- ALTER ... OWNER TO also requires the *new* owner to hold CREATE on the
-- object's schema (PostgreSQL docs: "that role must have CREATE privilege
-- on the object's schema"). identity_provisioner is NOLOGIN, so this does
-- not expand what anyone can actually do with it.
grant usage, create on schema public to identity_provisioner;

create or replace function public.provision_identity_and_organization(
  p_identity_provider text,
  p_identity_provider_subject text,
  p_display_name text,
  p_primary_email text
)
returns table(organization_id uuid, user_id uuid)
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  insert into public.users (identity_provider, identity_provider_subject, display_name, primary_email)
  values (p_identity_provider, p_identity_provider_subject, p_display_name, p_primary_email)
  returning id into v_user_id;

  insert into public.organizations (slug, display_name)
  values ('org-' || substr(v_user_id::text, 1, 8), p_display_name || '''s workspace')
  returning id into v_org_id;

  insert into public.memberships (organization_id, user_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  return query select v_org_id, v_user_id;
end;
$function$;

alter function public.provision_identity_and_organization(text, text, text, text) owner to identity_provisioner;
grant execute on function public.provision_identity_and_organization(text, text, text, text) to app_runtime;

create or replace function public.handle_new_auth_user()
returns trigger
security definer
set search_path = ''
language plpgsql
as $function$
begin
  perform public.provision_identity_and_organization(
    'supabase',
    new.id::text,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  return new;
end;
$function$;

alter function public.handle_new_auth_user() owner to identity_provisioner;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Read-only: answers "which org(s) does this exact identity belong to,"
-- nothing broader. This is the only way to resolve tenant context from a
-- freshly-validated session before any `app.current_organization_id` exists.
create or replace function public.resolve_memberships_for_identity(
  p_identity_provider text,
  p_identity_provider_subject text
)
returns table(organization_id uuid, user_id uuid, role text, status text)
security definer
set search_path = ''
stable
language sql
as $function$
  select m.organization_id, m.user_id, m.role, m.status
  from public.memberships m
  join public.users u on u.id = m.user_id
  where u.identity_provider = p_identity_provider
    and u.identity_provider_subject = p_identity_provider_subject
    and m.status = 'active';
$function$;

alter function public.resolve_memberships_for_identity(text, text) owner to identity_provisioner;
grant execute on function public.resolve_memberships_for_identity(text, text) to app_runtime;
