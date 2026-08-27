-- Real gap found by review, same session: the profile page tells a guest
-- (Supabase anonymous sign-in, ADR 0009) "create an account to keep this
-- workspace" (apps/web/app/profile/page.tsx), but nothing in the app
-- actually keeps it. signUpAction (apps/web/app/_actions/auth.ts) always
-- called supabase.auth.signUp(), which unconditionally mints a brand-new
-- auth.users row and fires handle_new_auth_user() again -- provisioning a
-- second, separate organization. The guest's real organization
-- (connections, goals, tasks) isn't deleted, but it becomes permanently
-- unreachable: it belongs to an anonymous auth.users row with no
-- credentials, so there is no way to ever sign back into it. This is a
-- real, silent data-loss bug that directly contradicts the product's own
-- stated promise.
--
-- Fixed at the application layer (same commit) by having signUpAction
-- call supabase.auth.updateUser({ email, password }) instead of signUp()
-- when the current session is already anonymous and carries no invite
-- token -- Supabase's own documented anonymous-user-upgrade flow, which
-- converts the SAME auth.users row in place rather than minting a new
-- one. That flow does not itself keep public.users/public.organizations
-- in sync, which is what this migration adds:
--
--   1. public.users.primary_email was set once at the original anonymous
--      INSERT (always null -- a guest never has an email) and nothing
--      updates it afterward. Left alone, a converted guest would show a
--      permanently null email everywhere public.users.primary_email is
--      read (e.g. the team roster, membership.ts).
--   2. organizations.is_guest (migration 0070) is "set once at
--      provisioning time... never reassigned afterward" by design, to
--      grant guest orgs full unmetered entitlements for evaluation. If a
--      converted guest's org silently keeps is_guest = true forever, the
--      fix above for (1) would accidentally open a permanent free-tier
--      bypass: sign in as guest, immediately convert to a real account,
--      keep unmetered access forever with a real paying-customer identity
--      attached. This must close in the same migration that makes guest
--      conversion actually preserve the organization, not as a
--      follow-up.
--
-- The trigger condition -- old.is_anonymous = true and new.is_anonymous
-- = false -- is the precise, documented signal for "this identity just
-- stopped being anonymous," correct regardless of whether the project
-- requires secure-email-change confirmation (is_anonymous flips only once
-- the confirmation link is followed) or not (it flips immediately inside
-- the same updateUser() call) -- both cases are a real UPDATE on
-- auth.users with exactly this transition, so one trigger covers both
-- without this migration needing to assume which is configured.
create or replace function public.handle_auth_user_anonymous_converted()
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

  if v_user_id is null then
    return new;
  end if;

  update public.users
  set primary_email = coalesce(new.email, primary_email)
  where id = v_user_id;

  update public.organizations o
  set is_guest = false
  from public.memberships m
  where m.organization_id = o.id
    and m.user_id = v_user_id
    and o.is_guest = true;

  return new;
end;
$function$;

alter function public.handle_auth_user_anonymous_converted() owner to identity_provisioner;

-- Same explicit revoke every SECURITY DEFINER trigger function here gets
-- (0008, 0072) -- PostgreSQL grants EXECUTE on a new function to PUBLIC
-- by default, which Supabase's PostgREST layer would otherwise turn into
-- a real, callable REST endpoint for anon/authenticated.
revoke execute on function public.handle_auth_user_anonymous_converted()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_anonymous_converted on auth.users;
create trigger on_auth_user_anonymous_converted
after update on auth.users
for each row
when (old.is_anonymous = true and new.is_anonymous = false)
execute function public.handle_auth_user_anonymous_converted();

-- Real gap found by the same review, distinct from the above: both
-- invite-consuming functions do a classic check-then-act -- SELECT a
-- pending invite, then unconditionally INSERT a membership for it, then
-- UPDATE the invite to 'accepted' by id alone. Neither takes a row lock
-- on the invite at the SELECT step, so two concurrent redemptions of the
-- same token can both pass the SELECT before either commits: both would
-- see status = 'pending', both would insert a real membership, and only
-- then would the second UPDATE discover (after blocking on the first
-- transaction's row lock, then re-reading its committed result) that the
-- invite is already 'accepted' -- too late, since the membership INSERT
-- already happened unconditionally before that check. Merely adding
-- `and status = 'pending'` to the UPDATE (which the app-layer
-- revokeOrganizationInvite, invites.ts, already does in its own WHERE
-- clause) would only stop the invite row itself from being
-- double-stamped; it would NOT stop the second concurrent transaction
-- from having already granted a real, duplicate membership from one
-- single-use token. The actual fix is `for update` on the initial
-- SELECT: it takes a real row lock immediately, so a second concurrent
-- call blocks there until the first transaction commits, then re-reads
-- the row's now-current ('accepted') status and correctly finds nothing
-- -- closing the race before the membership INSERT, not after.
--
-- Not currently reachable as a live double-redemption path (both
-- functions only ever run from the on_auth_user_created/
-- on_auth_user_confirmed triggers, gated on one auth.users row
-- transitioning state exactly once), but hardened to match this
-- codebase's own established concurrency-safety discipline
-- (packages/persistence/src/advisory-lock.ts's row/advisory-locking
-- pattern for exactly this class of check-then-act race) rather than
-- left as a latent inconsistency. Both functions are otherwise
-- byte-for-byte unchanged from their current live definitions (0070,
-- 0071).
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
    limit 1
    for update;
  end if;

  if v_invite_id is not null then
    insert into public.memberships (organization_id, user_id, role, status)
    values (v_invite_org_id, v_user_id, v_invite_role, 'active');

    update public.organization_invites
    set status = 'accepted', accepted_at = now(), updated_at = now()
    where id = v_invite_id and status = 'pending';

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
    limit 1
    for update;
  end if;

  if v_invite_id is not null then
    insert into public.memberships (organization_id, user_id, role, status)
    values (v_invite_org_id, p_user_id, v_invite_role, 'active');

    update public.organization_invites
    set status = 'accepted', accepted_at = now(), updated_at = now()
    where id = v_invite_id and status = 'pending';
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
