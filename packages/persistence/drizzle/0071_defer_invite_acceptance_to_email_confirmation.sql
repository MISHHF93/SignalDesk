-- P1 fix (ISSUES-REMAINING.md): a pending team invite could be
-- permanently consumed by someone who never actually owns the invited
-- email. handle_new_auth_user() fires on the auth.users INSERT trigger --
-- i.e. the instant a signup form is submitted, before Supabase's own
-- email-confirmation link has ever been clicked -- and that trigger is
-- what checked the invite token, marked the invite 'accepted', and
-- created the membership row, all in one transaction. The invite-token
-- match already correctly required lower(email) = lower(primary_email)
-- (a real, working defense -- you can't accept someone else's invite by
-- knowing the token alone), and signUpAction never returns a session
-- until that email is actually confirmed, so an attacker who submits a
-- signup claiming a victim's email gains nothing usable -- this was never
-- an account-takeover path. But the invite was still marked accepted at
-- that point, permanently burning the token even if the signup is never
-- confirmed (an attacker's decoy submission, a typo, someone who simply
-- abandons the flow) -- denying the real invitee their own later,
-- legitimate acceptance.
--
-- Fixed by moving invite acceptance out of the signup-submission trigger
-- and into a real post-confirmation hook, exactly as the audit's own
-- "real fix" description specified. provision_identity_and_organization
-- itself is deliberately left byte-for-byte unchanged below -- it's the
-- one function packages/persistence/tests/invites.test.ts and
-- identity.test.ts already exercise directly as "the same function every
-- real signup already calls," and every one of those tests' assertions
-- (immediate join, mismatched-email rejection, expired-invite rejection)
-- describes real, still-correct behavior for the paths that don't need
-- deferring: OAuth/guest sign-in (email already provider-verified, no
-- invite token ever attached to that path) and a project configured to
-- not require confirmation at all. Only one new case is added: a
-- password-signup carrying a real invite token whose email is NOT yet
-- confirmed at insert time defers to the new post-confirmation trigger
-- below instead of calling provision_identity_and_organization
-- immediately.

-- Creates just the users row -- no organization, no membership -- for a
-- signup that must defer its real provisioning decision until
-- confirmation. Mirrors provision_identity_and_organization's own insert
-- exactly (same columns, same not-null contract); deliberately does not
-- also create an organization here, unlike that function, since doing so
-- unconditionally is exactly the bug being fixed.
create or replace function public.provision_pending_identity(
  p_identity_provider text,
  p_identity_provider_subject text,
  p_display_name text,
  p_primary_email text
)
returns uuid
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_user_id uuid;
begin
  insert into public.users (identity_provider, identity_provider_subject, display_name, primary_email)
  values (p_identity_provider, p_identity_provider_subject, p_display_name, p_primary_email)
  returning id into v_user_id;

  return v_user_id;
end;
$function$;

alter function public.provision_pending_identity(text, text, text, text)
  owner to identity_provisioner;

revoke execute on function public.provision_pending_identity(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.provision_pending_identity(text, text, text, text)
  to app_runtime;

-- Called once a deferred signup's email is actually confirmed (see the
-- new on_auth_user_confirmed trigger below). Re-validates the invite at
-- confirmation time rather than trusting whatever was true at signup --
-- the invite may have since expired, been revoked, or already been
-- consumed by someone else re-sent a fresh token; the same honest
-- fallback provision_identity_and_organization's own else-branch already
-- uses (a normal solo organization) applies here identically, so a
-- confirmed user is never left with no organization at all.
--
-- Idempotent by construction: a user who already has any membership --
-- because they were provisioned immediately (no invite token, or an
-- already-confirmed-at-insert project/OAuth/guest path) and this trigger
-- still fires for their own later email-confirmation transition -- is a
-- deliberate no-op, not a second organization.
create or replace function public.complete_deferred_identity_provisioning(
  p_user_id uuid,
  p_invite_token text,
  p_display_name text
)
returns void
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_already_member boolean;
  v_primary_email text;
  v_invite_id uuid;
  v_invite_org_id uuid;
  v_invite_role text;
  v_org_id uuid;
begin
  select exists(select 1 from public.memberships where user_id = p_user_id)
    into v_already_member;

  if v_already_member then
    return;
  end if;

  select primary_email into v_primary_email
  from public.users
  where id = p_user_id;

  if v_primary_email is null then
    -- No matching users row (should be unreachable -- the trigger below
    -- only calls this after finding one) -- fail closed rather than
    -- provision against a null email.
    return;
  end if;

  if p_invite_token is not null then
    select oi.id, oi.organization_id, oi.role
      into v_invite_id, v_invite_org_id, v_invite_role
    from public.organization_invites oi
    where oi.token = p_invite_token
      and oi.status = 'pending'
      and oi.expires_at > now()
      and lower(oi.email) = lower(v_primary_email)
    limit 1;
  end if;

  if v_invite_id is not null then
    insert into public.memberships (organization_id, user_id, role, status)
    values (v_invite_org_id, p_user_id, v_invite_role, 'active');

    update public.organization_invites
    set status = 'accepted', accepted_at = now(), updated_at = now()
    where id = v_invite_id;
  else
    insert into public.organizations (slug, display_name)
    values ('org-' || substr(p_user_id::text, 1, 8), p_display_name || '''s workspace')
    returning id into v_org_id;

    insert into public.memberships (organization_id, user_id, role, status)
    values (v_org_id, p_user_id, 'owner', 'active');
  end if;
end;
$function$;

alter function public.complete_deferred_identity_provisioning(uuid, text, text)
  owner to identity_provisioner;

revoke execute on function public.complete_deferred_identity_provisioning(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_deferred_identity_provisioning(uuid, text, text)
  to app_runtime;

-- handle_new_auth_user()'s dispatch: only a password signup that both
-- carries a real invite token AND still needs confirmation takes the new
-- deferred path. Every other case (no invite token at all; an
-- already-confirmed-at-insert project config; OAuth, whose email the
-- provider already verified; guest sign-in, which never carries an
-- invite token) provisions immediately exactly as before, through the
-- same unchanged provision_identity_and_organization call.
create or replace function public.handle_new_auth_user()
returns trigger
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_invite_token text := new.raw_user_meta_data ->> 'invite_token';
begin
  if v_invite_token is not null and new.email_confirmed_at is null then
    perform public.provision_pending_identity(
      'supabase',
      new.id::text,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Guest'),
      new.email
    );
  else
    perform public.provision_identity_and_organization(
      'supabase',
      new.id::text,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Guest'),
      new.email,
      v_invite_token,
      new.is_anonymous
    );
  end if;

  return new;
end;
$function$;

alter function public.handle_new_auth_user() owner to identity_provisioner;

-- The real post-confirmation hook. Supabase Auth's own email-verification
-- flow updates auth.users.email_confirmed_at directly (a real UPDATE
-- statement GoTrue issues against this table on a successful
-- confirmation, independent of whatever page the confirmation link
-- redirects the browser to afterward) -- the same real, documented signal
-- this fix's own audit entry named as "a real trigger on
-- auth.users.email_confirmed_at transitioning from null."
--
-- Looks the user up by identity rather than trusting a passed-in id,
-- matching resolve_memberships_for_identity's own real lookup shape
-- (drizzle/0007) -- this is the same SECURITY DEFINER boundary crossing
-- from an unauthenticated trigger context into public.users that every
-- other function here already does.
create or replace function public.handle_auth_user_confirmed()
returns trigger
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from public.users
  where identity_provider = 'supabase'
    and identity_provider_subject = new.id::text;

  if v_user_id is not null then
    perform public.complete_deferred_identity_provisioning(
      v_user_id,
      new.raw_user_meta_data ->> 'invite_token',
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Guest')
    );
  end if;

  return new;
end;
$function$;

alter function public.handle_auth_user_confirmed() owner to identity_provisioner;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
after update on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.handle_auth_user_confirmed();
