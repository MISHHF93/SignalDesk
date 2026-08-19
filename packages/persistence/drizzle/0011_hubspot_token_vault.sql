-- Real HubSpot OAuth token storage (ADR 0008). Tokens are third-party
-- credentials with live access to a customer's real business data, a
-- materially higher bar than anything else in this schema. Storage uses
-- Supabase Vault: the encryption key lives outside this database entirely
-- (Supabase's backend), so a database dump alone cannot decrypt a token.
--
-- Unlike identity_provisioner (0007), which must run BEFORE any tenant
-- context exists, these functions run from an already-authenticated,
-- already-tenant-scoped session (a signed-in user connecting HubSpot) —
-- so identity_token_manager does NOT get BYPASSRLS. Its queries against
-- `integrations` are still subject to the same RLS policies app_runtime
-- has, giving real defense in depth rather than an application-level
-- check alone. It only needs elevated privilege for vault.* itself, which
-- app_runtime is never granted directly.

alter table public.integrations
  add column token_vault_secret_id uuid;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'integration_token_manager') then
    create role integration_token_manager nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
  end if;
end
$$;

grant integration_token_manager to current_user;
grant usage, create on schema public to integration_token_manager;
grant select, update on table public.integrations to integration_token_manager;
grant usage on schema vault to integration_token_manager;
grant select on table vault.decrypted_secrets to integration_token_manager;
grant execute on function vault.create_secret(text, text, text, uuid) to integration_token_manager;
grant execute on function vault.update_secret(uuid, text, text, text, uuid) to integration_token_manager;

create or replace function public.store_hubspot_tokens(
  p_integration_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz
)
returns void
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_existing_secret_id uuid;
  v_payload text;
begin
  -- Relies on RLS (organization_id = app.current_organization_id) to
  -- confirm this integration belongs to the caller's own tenant — this
  -- select returns zero rows for a foreign integration, not an error, so
  -- the explicit check below is what actually fails closed.
  select token_vault_secret_id into v_existing_secret_id
  from public.integrations
  where id = p_integration_id;

  if not found then
    raise exception 'integration % not found in the current tenant context', p_integration_id
      using errcode = '42501';
  end if;

  v_payload := jsonb_build_object(
    'access_token', p_access_token,
    'refresh_token', p_refresh_token,
    'expires_at', p_expires_at
  )::text;

  if v_existing_secret_id is null then
    v_existing_secret_id := vault.create_secret(
      v_payload,
      'hubspot_tokens:' || p_integration_id::text,
      'HubSpot OAuth tokens for integration ' || p_integration_id::text
    );

    update public.integrations
    set token_vault_secret_id = v_existing_secret_id
    where id = p_integration_id;
  else
    perform vault.update_secret(v_existing_secret_id, v_payload);
  end if;
end;
$function$;

alter function public.store_hubspot_tokens(uuid, text, text, timestamptz) owner to integration_token_manager;
revoke execute on function public.store_hubspot_tokens(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.store_hubspot_tokens(uuid, text, text, timestamptz) to app_runtime;

create or replace function public.get_hubspot_tokens(p_integration_id uuid)
returns table(access_token text, refresh_token text, expires_at timestamptz)
security definer
set search_path = ''
stable
language plpgsql
as $function$
declare
  v_secret_id uuid;
  v_payload jsonb;
begin
  select token_vault_secret_id into v_secret_id
  from public.integrations
  where id = p_integration_id;

  if not found or v_secret_id is null then
    return;
  end if;

  select decrypted_secret::jsonb into v_payload
  from vault.decrypted_secrets
  where id = v_secret_id;

  if v_payload is null then
    return;
  end if;

  return query select
    v_payload ->> 'access_token',
    v_payload ->> 'refresh_token',
    (v_payload ->> 'expires_at')::timestamptz;
end;
$function$;

alter function public.get_hubspot_tokens(uuid) owner to integration_token_manager;
revoke execute on function public.get_hubspot_tokens(uuid) from public, anon, authenticated;
grant execute on function public.get_hubspot_tokens(uuid) to app_runtime;
