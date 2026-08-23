-- Real bug caught by a live test: provision_identity_and_organization's
-- `returns table(organization_id uuid, user_id uuid)` makes
-- `organization_id` an implicitly-visible PL/pgSQL variable inside the
-- function body, colliding with organization_invites' real
-- `organization_id` column in the unqualified `select id,
-- organization_id, role from organization_invites` lookup — Postgres
-- error 42702, "column reference is ambiguous". Fixed by table-aliasing
-- and qualifying every selected column, the same way the rest of this
-- codebase's queries already do for any join/ambiguity risk.

create or replace function public.provision_identity_and_organization(
  p_identity_provider text,
  p_identity_provider_subject text,
  p_display_name text,
  p_primary_email text,
  p_invite_token text default null
)
returns table(organization_id uuid, user_id uuid)
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_invite_id uuid;
  v_invite_org_id uuid;
  v_invite_role text;
begin
  insert into public.users (identity_provider, identity_provider_subject, display_name, primary_email)
  values (p_identity_provider, p_identity_provider_subject, p_display_name, p_primary_email)
  returning id into v_user_id;

  if p_invite_token is not null then
    select oi.id, oi.organization_id, oi.role
      into v_invite_id, v_invite_org_id, v_invite_role
    from public.organization_invites oi
    where oi.token = p_invite_token
      and oi.status = 'pending'
      and oi.expires_at > now()
      and lower(oi.email) = lower(p_primary_email)
    limit 1;
  end if;

  if v_invite_id is not null then
    insert into public.memberships (organization_id, user_id, role, status)
    values (v_invite_org_id, v_user_id, v_invite_role, 'active');

    update public.organization_invites
    set status = 'accepted', accepted_at = now(), updated_at = now()
    where id = v_invite_id;

    return query select v_invite_org_id, v_user_id;
  else
    insert into public.organizations (slug, display_name)
    values ('org-' || substr(v_user_id::text, 1, 8), p_display_name || '''s workspace')
    returning id into v_org_id;

    insert into public.memberships (organization_id, user_id, role, status)
    values (v_org_id, v_user_id, 'owner', 'active');

    return query select v_org_id, v_user_id;
  end if;
end;
$function$;
