-- Supabase's auth_rls_initplan advisor: every policy below called
-- current_setting('app.current_organization_id', true) directly, which
-- Postgres re-evaluates once PER ROW rather than once per statement.
-- Wrapping the call in a scalar subquery — (select current_setting(...))
-- — lets the planner hoist it into an initplan, evaluated once. Same
-- policies, same security semantics; only the evaluation cost changes.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- organizations
drop policy if exists organizations_tenant_select on public.organizations;
--> statement-breakpoint
create policy organizations_tenant_select on public.organizations
  for select
  using (
    id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists organizations_tenant_insert on public.organizations;
--> statement-breakpoint
create policy organizations_tenant_insert on public.organizations
  for insert
  with check (
    id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists organizations_tenant_update on public.organizations;
--> statement-breakpoint
create policy organizations_tenant_update on public.organizations
  for update
  using (
    id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- memberships
drop policy if exists memberships_tenant_select on public.memberships;
--> statement-breakpoint
create policy memberships_tenant_select on public.memberships
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists memberships_tenant_insert on public.memberships;
--> statement-breakpoint
create policy memberships_tenant_insert on public.memberships
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists memberships_tenant_update on public.memberships;
--> statement-breakpoint
create policy memberships_tenant_update on public.memberships
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- users (subquery form)
drop policy if exists users_tenant_select on public.users;
--> statement-breakpoint
create policy users_tenant_select on public.users
  for select
  using (
    exists (
      select 1
      from public.memberships
      where memberships.user_id = users.id
        and memberships.organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
    )
  );
--> statement-breakpoint

-- integrations
drop policy if exists integrations_tenant_select on public.integrations;
--> statement-breakpoint
create policy integrations_tenant_select on public.integrations
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists integrations_tenant_insert on public.integrations;
--> statement-breakpoint
create policy integrations_tenant_insert on public.integrations
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists integrations_tenant_update on public.integrations;
--> statement-breakpoint
create policy integrations_tenant_update on public.integrations
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- source_records (append-only: select + insert only)
drop policy if exists source_records_tenant_select on public.source_records;
--> statement-breakpoint
create policy source_records_tenant_select on public.source_records
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists source_records_tenant_insert on public.source_records;
--> statement-breakpoint
create policy source_records_tenant_insert on public.source_records
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- leads (append-only: select + insert only)
drop policy if exists leads_tenant_select on public.leads;
--> statement-breakpoint
create policy leads_tenant_select on public.leads
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists leads_tenant_insert on public.leads;
--> statement-breakpoint
create policy leads_tenant_insert on public.leads
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- signals
drop policy if exists signals_tenant_select on public.signals;
--> statement-breakpoint
create policy signals_tenant_select on public.signals
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists signals_tenant_insert on public.signals;
--> statement-breakpoint
create policy signals_tenant_insert on public.signals
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists signals_tenant_update on public.signals;
--> statement-breakpoint
create policy signals_tenant_update on public.signals
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- recommendations
drop policy if exists recommendations_tenant_select on public.recommendations;
--> statement-breakpoint
create policy recommendations_tenant_select on public.recommendations
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists recommendations_tenant_insert on public.recommendations;
--> statement-breakpoint
create policy recommendations_tenant_insert on public.recommendations
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists recommendations_tenant_update on public.recommendations;
--> statement-breakpoint
create policy recommendations_tenant_update on public.recommendations
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- audit_events (append-only: select + insert only)
drop policy if exists audit_events_tenant_select on public.audit_events;
--> statement-breakpoint
create policy audit_events_tenant_select on public.audit_events
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists audit_events_tenant_insert on public.audit_events;
--> statement-breakpoint
create policy audit_events_tenant_insert on public.audit_events
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- internal_tasks
drop policy if exists internal_tasks_tenant_select on public.internal_tasks;
--> statement-breakpoint
create policy internal_tasks_tenant_select on public.internal_tasks
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists internal_tasks_tenant_insert on public.internal_tasks;
--> statement-breakpoint
create policy internal_tasks_tenant_insert on public.internal_tasks
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists internal_tasks_tenant_update on public.internal_tasks;
--> statement-breakpoint
create policy internal_tasks_tenant_update on public.internal_tasks
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- Covering indexes for foreign keys the performance advisor flagged as
-- unindexed (each FK lookup/cascade check was doing a full table scan).
create index if not exists "audit_events_org_actor_membership_index" on "audit_events" ("organization_id","actor_membership_id");
--> statement-breakpoint
create index if not exists "audit_events_org_source_record_index" on "audit_events" ("organization_id","source_record_id");
--> statement-breakpoint
create index if not exists "leads_org_owner_membership_index" on "leads" ("organization_id","owner_membership_id");
--> statement-breakpoint
create index if not exists "signals_org_lead_source_index" on "signals" ("organization_id","lead_id","source_record_id");
--> statement-breakpoint
create index if not exists "recommendations_org_signal_lead_source_index" on "recommendations" ("organization_id","signal_id","lead_id","source_record_id");

