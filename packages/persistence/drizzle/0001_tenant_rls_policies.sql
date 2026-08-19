-- Fail-closed tenant isolation for the application role.
--
-- Every application transaction must set its tenant context locally:
--   SELECT set_config('app.current_organization_id', '<organization uuid>', true);
-- The application role must not own these tables, be a superuser, or have
-- BYPASSRLS. Identity provisioning requires a separately reviewed role.

alter table public.organizations enable row level security;
--> statement-breakpoint
alter table public.organizations force row level security;
--> statement-breakpoint
drop policy if exists organizations_tenant_isolation on public.organizations;
--> statement-breakpoint
create policy organizations_tenant_isolation on public.organizations
  for all
  using (
    id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

alter table public.memberships enable row level security;
--> statement-breakpoint
alter table public.memberships force row level security;
--> statement-breakpoint
drop policy if exists memberships_tenant_isolation on public.memberships;
--> statement-breakpoint
create policy memberships_tenant_isolation on public.memberships
  for all
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

-- Global identities are readable only through a current-tenant membership.
alter table public.users enable row level security;
--> statement-breakpoint
alter table public.users force row level security;
--> statement-breakpoint
drop policy if exists users_tenant_select on public.users;
--> statement-breakpoint
create policy users_tenant_select on public.users
  for select
  using (
    exists (
      select 1
      from public.memberships
      where memberships.user_id = users.id
        and memberships.organization_id = nullif(
          current_setting('app.current_organization_id', true),
          ''
        )::uuid
    )
  );
--> statement-breakpoint

alter table public.source_records enable row level security;
--> statement-breakpoint
alter table public.source_records force row level security;
--> statement-breakpoint
drop policy if exists source_records_tenant_isolation on public.source_records;
--> statement-breakpoint
create policy source_records_tenant_isolation on public.source_records
  for all
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

alter table public.leads enable row level security;
--> statement-breakpoint
alter table public.leads force row level security;
--> statement-breakpoint
drop policy if exists leads_tenant_isolation on public.leads;
--> statement-breakpoint
create policy leads_tenant_isolation on public.leads
  for all
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

alter table public.signals enable row level security;
--> statement-breakpoint
alter table public.signals force row level security;
--> statement-breakpoint
drop policy if exists signals_tenant_isolation on public.signals;
--> statement-breakpoint
create policy signals_tenant_isolation on public.signals
  for all
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

alter table public.recommendations enable row level security;
--> statement-breakpoint
alter table public.recommendations force row level security;
--> statement-breakpoint
drop policy if exists recommendations_tenant_isolation on public.recommendations;
--> statement-breakpoint
create policy recommendations_tenant_isolation on public.recommendations
  for all
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

-- Audit events are append-only for ordinary application roles: there are no
-- UPDATE or DELETE policies.
alter table public.audit_events enable row level security;
--> statement-breakpoint
alter table public.audit_events force row level security;
--> statement-breakpoint
drop policy if exists audit_events_tenant_select on public.audit_events;
--> statement-breakpoint
create policy audit_events_tenant_select on public.audit_events
  for select
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
drop policy if exists audit_events_tenant_insert on public.audit_events;
--> statement-breakpoint
create policy audit_events_tenant_insert on public.audit_events
  for insert
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
