-- Least-privilege application role.
--
-- Migrations in ../drizzle run under the database's owner/superuser role.
-- All ordinary application traffic must run as app_runtime instead: it is
-- not a superuser, does not own any table, and does not have BYPASSRLS, so
-- the forced RLS policies in 0001_tenant_rls_policies.sql and
-- 0003_harden_tenant_provenance.sql actually apply to it.
--
-- Run this once per environment via a trusted operator session (for example
-- the Supabase SQL editor or `execute_sql`), substituting a real generated
-- password for the placeholder below. Never commit the real password; store
-- it only in that environment's secret manager / local .env.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime login nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
  end if;
end
$$;

alter role app_runtime password '__REPLACE_WITH_GENERATED_SECRET__';

-- Supabase projects default-grant table access to anon/authenticated for
-- PostgREST. This application never calls the Supabase API layer, so those
-- grants must be stripped explicitly rather than relying on RLS alone.
revoke all on all tables in schema public from public;
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant usage on schema public to app_runtime;

-- Append-mostly business tables: no DELETE grant anywhere. There is no
-- ordinary delete path by design (see README.md "Database setup").
grant select, insert, update on
  public.organizations,
  public.memberships,
  public.users,
  public.integrations,
  public.source_records,
  public.leads,
  public.invoices,
  public.tasks,
  public.signals,
  public.recommendations,
  public.internal_tasks
to app_runtime;

-- Audit events are append-only even for INSERT/UPDATE: no UPDATE grant, and
-- the RLS policies in 0001_tenant_rls_policies.sql define no UPDATE/DELETE
-- policy for this table either.
grant select, insert on public.audit_events to app_runtime;

-- Artifacts (0031): select + insert only. v1 never transitions an
-- artifact's status (no review/approval flow exists yet), so there is no
-- real UPDATE path to grant.
grant select, insert on public.artifacts to app_runtime;

-- Billing catalog (0022): global, not tenant-scoped, read-only for the
-- app — new prices/entitlement versions/promotions are added by a future
-- migration, not by application code.
grant select on
  public.plans,
  public.plan_prices,
  public.plan_entitlements,
  public.plan_addons
to app_runtime;

-- Billing subscription state (0022): real tenant data, forced RLS.
grant select, insert, update on
  public.organization_subscriptions,
  public.organization_subscription_addons
to app_runtime;

-- Internal-only unit-economics instrumentation (0022): never exposed
-- through any customer-facing query.
grant select, insert on public.internal_cost_events to app_runtime;

-- One narrow exception to "catalog tables are read-only for the app"
-- (0024): a successful checkout that redeems a promotional price must
-- increment that price's own redemption counter as routine customer-
-- facing traffic. Column-level grant only — nothing else about a price
-- becomes writable by the app.
grant update (promo_redemptions_count) on public.plan_prices to app_runtime;

-- organization_subscription_addons (0027): real current-state config,
-- not append-only audit data, and its own quantity>0 check constraint
-- rules out a "quantity 0 = removed" soft-delete convention — removing
-- an add-on genuinely needs a hard delete, unlike this codebase's other
-- append-mostly tables.
grant delete on public.organization_subscription_addons to app_runtime;
