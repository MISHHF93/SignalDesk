CREATE TABLE "ai_provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"vault_secret_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_provider_connections_org_provider_unique" UNIQUE("organization_id","provider"),
	CONSTRAINT "ai_provider_connections_provider_allowed" CHECK ("ai_provider_connections"."provider" in ('anthropic'))
);
--> statement-breakpoint
ALTER TABLE "ai_provider_connections" ADD CONSTRAINT "ai_provider_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Real, per-organization AI provider API keys (Phase 4c, implementation
-- roadmap). Standard tenant RLS for the row itself (status/enabled flag,
-- never the key); the real key lives only in Supabase Vault, reached
-- exclusively through the three SECURITY DEFINER functions below, the
-- same "encryption key lives outside this database entirely" guarantee
-- migration 0011 established for OAuth tokens.

alter table public.ai_provider_connections enable row level security;
--> statement-breakpoint
alter table public.ai_provider_connections force row level security;
--> statement-breakpoint

create policy ai_provider_connections_tenant_select on public.ai_provider_connections
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy ai_provider_connections_tenant_insert on public.ai_provider_connections
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy ai_provider_connections_tenant_update on public.ai_provider_connections
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.ai_provider_connections from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update, delete on public.ai_provider_connections to app_runtime;
--> statement-breakpoint

-- A new, narrow SECURITY DEFINER role, mirroring integration_token_manager's
-- exact grant block (migration 0011) — never BYPASSRLS, so its own queries
-- against ai_provider_connections stay subject to the same RLS app_runtime
-- has, giving real defense in depth rather than an application-level check
-- alone.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_provider_key_manager') then
    create role ai_provider_key_manager nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
  end if;
end
$$;
--> statement-breakpoint

grant ai_provider_key_manager to current_user;
--> statement-breakpoint
grant usage, create on schema public to ai_provider_key_manager;
--> statement-breakpoint
grant select, update, delete on table public.ai_provider_connections to ai_provider_key_manager;
--> statement-breakpoint
grant usage on schema vault to ai_provider_key_manager;
--> statement-breakpoint
grant select on table vault.decrypted_secrets to ai_provider_key_manager;
--> statement-breakpoint
grant execute on function vault.create_secret(text, text, text, uuid) to ai_provider_key_manager;
--> statement-breakpoint
grant execute on function vault.update_secret(uuid, text, text, text, uuid) to ai_provider_key_manager;
--> statement-breakpoint

create or replace function public.store_ai_provider_key(
  p_connection_id uuid,
  p_api_key text
)
returns void
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_existing_secret_id uuid;
begin
  -- Relies on RLS (organization_id = app.current_organization_id) to
  -- confirm this connection belongs to the caller's own tenant — this
  -- select returns zero rows for a foreign connection, not an error, so
  -- the explicit check below is what actually fails closed. Mirrors
  -- store_integration_tokens's exact reasoning (migration 0019).
  select vault_secret_id into v_existing_secret_id
  from public.ai_provider_connections
  where id = p_connection_id;

  if not found then
    raise exception 'ai provider connection % not found in the current tenant context', p_connection_id
      using errcode = '42501';
  end if;

  if v_existing_secret_id is null then
    v_existing_secret_id := vault.create_secret(
      p_api_key,
      'ai_provider_key:' || p_connection_id::text,
      'AI provider API key for connection ' || p_connection_id::text
    );

    update public.ai_provider_connections
    set vault_secret_id = v_existing_secret_id
    where id = p_connection_id;
  else
    perform vault.update_secret(v_existing_secret_id, p_api_key);
  end if;
end;
$function$;
--> statement-breakpoint

alter function public.store_ai_provider_key(uuid, text) owner to ai_provider_key_manager;
--> statement-breakpoint
revoke execute on function public.store_ai_provider_key(uuid, text) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.store_ai_provider_key(uuid, text) to app_runtime;
--> statement-breakpoint

create or replace function public.get_ai_provider_key(p_connection_id uuid)
returns text
security definer
set search_path = ''
stable
language plpgsql
as $function$
declare
  v_secret_id uuid;
begin
  select vault_secret_id into v_secret_id
  from public.ai_provider_connections
  where id = p_connection_id and enabled = true;

  if not found or v_secret_id is null then
    return null;
  end if;

  return (
    select decrypted_secret from vault.decrypted_secrets where id = v_secret_id
  );
end;
$function$;
--> statement-breakpoint

alter function public.get_ai_provider_key(uuid) owner to ai_provider_key_manager;
--> statement-breakpoint
revoke execute on function public.get_ai_provider_key(uuid) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.get_ai_provider_key(uuid) to app_runtime;
--> statement-breakpoint

-- Real disconnect: deletes the Vault-stored key and the connection row
-- itself (unlike disconnect_integration, which keeps the integrations
-- row and marks it disconnected — there is no analogous "reconnect
-- history" concept worth keeping for a bare API key; a removed key
-- should leave no trace beyond the audit event the calling Server Action
-- records).
create or replace function public.delete_ai_provider_connection(p_connection_id uuid)
returns void
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_secret_id uuid;
begin
  select vault_secret_id into v_secret_id
  from public.ai_provider_connections
  where id = p_connection_id;

  if not found then
    raise exception 'ai provider connection % not found in the current tenant context', p_connection_id
      using errcode = '42501';
  end if;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;

  delete from public.ai_provider_connections where id = p_connection_id;
end;
$function$;
--> statement-breakpoint

alter function public.delete_ai_provider_connection(uuid) owner to ai_provider_key_manager;
--> statement-breakpoint
revoke execute on function public.delete_ai_provider_connection(uuid) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.delete_ai_provider_connection(uuid) to app_runtime;