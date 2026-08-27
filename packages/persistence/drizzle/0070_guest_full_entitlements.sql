-- Real gap found by review: guest sign-in (ADR 0009) provisions a real,
-- isolated organization with a real 'owner' membership, but never a real
-- subscription -- guest sign-in never goes through Stripe checkout (no
-- card, no email to bill), and `start-checkout.ts` correctly refuses to
-- let an anonymous session start real billing (`session.isAnonymous`
-- check, left untouched -- that guard is real safety, not a gap). With
-- no subscription row, `getEntitlementUsage` (subscriptions.ts) already
-- and correctly falls back to the same zero-entitlement branch a churned
-- real customer gets, so `canAddActiveConnection` denies every guest
-- organization before it can connect a single integration -- the one
-- real, currently-enforced restriction left on a guest session (role is
-- already 'owner' since migration 0007; the only other real gate,
-- `start-checkout.ts`'s billing block, is deliberate and untouched here).
--
-- Fixed with a real, explicit fact rather than a fabricated Stripe-shaped
-- subscription row: `organizations.is_guest`, set once at provisioning
-- time from Supabase Auth's own `auth.users.is_anonymous` (never
-- reassigned afterward), which `getEntitlementUsage` now checks first to
-- grant full, unmetered entitlements for evaluation/demo purposes.

alter table public.organizations
  add column is_guest boolean not null default false;

-- provision_identity_and_organization gains a 6th parameter -- Postgres
-- treats a changed parameter list as a distinct signature, so the old
-- 5-arg function must be dropped first (same pattern migration 0046 used
-- when adding p_invite_token as the 5th parameter).
drop function if exists public.provision_identity_and_organization(text, text, text, text, text);

create or replace function public.provision_identity_and_organization(
  p_identity_provider text,
  p_identity_provider_subject text,
  p_display_name text,
  p_primary_email text,
  p_invite_token text default null,
  p_is_guest boolean default false
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
    insert into public.organizations (slug, display_name, is_guest)
    values ('org-' || substr(v_user_id::text, 1, 8), p_display_name || '''s workspace', p_is_guest)
    returning id into v_org_id;

    insert into public.memberships (organization_id, user_id, role, status)
    values (v_org_id, v_user_id, 'owner', 'active');

    return query select v_org_id, v_user_id;
  end if;
end;
$function$;

alter function public.provision_identity_and_organization(text, text, text, text, text, boolean)
  owner to identity_provisioner;

-- PostgreSQL grants EXECUTE on a new function to PUBLIC by default
-- (migrations 0008/0046/0058/0061/0065b's own recurring fix for exactly
-- this) -- revoked in the same migration that creates this new
-- signature, not a follow-up fix after the fact. This is a real
-- server-to-server function only app_runtime and this table's own
-- trigger call, never a PostgREST RPC endpoint.
revoke execute on function public.provision_identity_and_organization(text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.provision_identity_and_organization(text, text, text, text, text, boolean)
  to app_runtime;

-- handle_new_auth_user()'s own signature is unchanged (a trigger takes no
-- arguments) -- only its body changes, to pass Supabase Auth's real
-- `is_anonymous` flag through as the new 6th argument.
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
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Guest'),
    new.email,
    new.raw_user_meta_data ->> 'invite_token',
    new.is_anonymous
  );
  return new;
end;
$function$;

alter function public.handle_new_auth_user() owner to identity_provisioner;
