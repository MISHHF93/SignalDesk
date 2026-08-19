-- Generalizes the HubSpot-named token-storage/disconnect functions (0011,
-- 0016) into provider-neutral ones, for the Slack connector (and any
-- future one) to share rather than duplicating Vault logic per provider —
-- the "Connector Runtime" principle: provider-specific behavior belongs in
-- the TypeScript client (packages/integrations/src/<provider>/client.ts),
-- never re-scattered through the database layer. Nothing about the
-- underlying logic actually was HubSpot-specific — only the names were —
-- confirmed by inspection before writing this migration.
--
-- `p_refresh_token`/`p_expires_at` become nullable: unlike HubSpot's
-- tokens (always expire, always issue a refresh token), Slack's standard
-- OAuth v2 bot tokens are persistent by default and carry neither, per
-- Slack's own current docs (docs.slack.dev/authentication/installing-with-oauth).
-- Forcing HubSpot's always-expiring assumption onto a provider that
-- doesn't expire would be dishonest, not just inconvenient.
--
-- The old HubSpot-named functions are dropped in this same migration —
-- every TypeScript call site is updated in the same change, so nothing is
-- left calling a function that no longer exists.

create or replace function public.store_integration_tokens(
  p_integration_id uuid,
  p_access_token text,
  p_refresh_token text default null,
  p_expires_at timestamptz default null
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
      'integration_tokens:' || p_integration_id::text,
      'OAuth tokens for integration ' || p_integration_id::text
    );

    update public.integrations
    set token_vault_secret_id = v_existing_secret_id
    where id = p_integration_id;
  else
    perform vault.update_secret(v_existing_secret_id, v_payload);
  end if;
end;
$function$;

alter function public.store_integration_tokens(uuid, text, text, timestamptz) owner to integration_token_manager;
revoke execute on function public.store_integration_tokens(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.store_integration_tokens(uuid, text, text, timestamptz) to app_runtime;

create or replace function public.get_integration_tokens(p_integration_id uuid)
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

alter function public.get_integration_tokens(uuid) owner to integration_token_manager;
revoke execute on function public.get_integration_tokens(uuid) from public, anon, authenticated;
grant execute on function public.get_integration_tokens(uuid) to app_runtime;

create or replace function public.disconnect_integration(p_integration_id uuid)
returns void
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_secret_id uuid;
begin
  select token_vault_secret_id into v_secret_id
  from public.integrations
  where id = p_integration_id;

  if not found then
    raise exception 'integration % not found in the current tenant context', p_integration_id
      using errcode = '42501';
  end if;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;

  update public.integrations
  set token_vault_secret_id = null, status = 'disconnected'
  where id = p_integration_id;
end;
$function$;

alter function public.disconnect_integration(uuid) owner to integration_token_manager;
revoke execute on function public.disconnect_integration(uuid) from public, anon, authenticated;
grant execute on function public.disconnect_integration(uuid) to app_runtime;

drop function public.store_hubspot_tokens(uuid, text, text, timestamptz);
drop function public.get_hubspot_tokens(uuid);
drop function public.disconnect_hubspot_integration(uuid);
