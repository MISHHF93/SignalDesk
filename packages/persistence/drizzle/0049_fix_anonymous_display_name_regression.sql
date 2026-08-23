-- Migration 0046 recreated handle_new_auth_user() to pass a 5th
-- invite_token argument, but its coalesce() reverted to the pre-0013
-- two-argument form (full_name, email), dropping the 'Guest' fallback
-- migration 0013 added specifically because a real anonymous Supabase
-- sign-in has both raw_user_meta_data.full_name and email as NULL,
-- which fails users.display_name's NOT NULL constraint. Caught live via
-- Playwright: "Database error creating anonymous user" on /login's
-- "Continue as guest" button after this phase's changes. Restores the
-- fallback while keeping the invite_token plumbing.
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
    new.raw_user_meta_data ->> 'invite_token'
  );
  return new;
end;
$function$;

alter function public.handle_new_auth_user() owner to identity_provisioner;
