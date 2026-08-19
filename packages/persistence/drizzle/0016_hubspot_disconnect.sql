-- Real disconnect for HubSpot (extends ADR 0008): until now there was no
-- way, even in principle, for the app to stop syncing or delete a
-- connected org's HubSpot tokens short of a manual DB operation. This adds
-- one function that deletes the Vault secret and marks the integration
-- disconnected, in the same tenant-scoped transaction, following the same
-- ownership/RLS-reliance pattern as store_hubspot_tokens/get_hubspot_tokens
-- (0011) — integration_token_manager still has no BYPASSRLS.

grant select, delete on table vault.secrets to integration_token_manager;

create or replace function public.disconnect_hubspot_integration(p_integration_id uuid)
returns void
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_secret_id uuid;
begin
  -- Relies on RLS, same as store_hubspot_tokens: this select returns zero
  -- rows (not an error) for an integration outside the caller's tenant.
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

alter function public.disconnect_hubspot_integration(uuid) owner to integration_token_manager;
revoke execute on function public.disconnect_hubspot_integration(uuid) from public, anon, authenticated;
grant execute on function public.disconnect_hubspot_integration(uuid) to app_runtime;
