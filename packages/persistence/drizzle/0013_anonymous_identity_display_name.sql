-- Guest access (ADR 0009) uses Supabase Auth's anonymous sign-in
-- (supabase.auth.signInAnonymously()), which creates a real auth.users row
-- with email = NULL and no raw_user_meta_data.full_name. The existing
-- trigger's `coalesce(full_name, email)` would then pass NULL into
-- users.display_name, which is NOT NULL with a non-blank check constraint
-- (0000) — every anonymous sign-in would fail at the trigger and never
-- reach the client as a clear error. Add a final "Guest" fallback.
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
    new.email
  );
  return new;
end;
$function$;
