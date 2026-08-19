-- Real Asana task sync: a third connector-fed Business Graph entity
-- alongside leads (HubSpot) and invoices (QuickBooks) — same shape again
-- (a normalized table downstream of source_records, append-only for
-- app_runtime, one row per synced task), extending real intelligence
-- coverage into a third domain: Delivery, alongside Sales and Finance.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_record_id uuid not null,
  name text not null,
  assignee_name text,
  due_at timestamptz not null,
  completed boolean not null,
  canonical_schema_version integer not null,
  normalization_version text not null,
  normalized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_org_id_id_unique unique (organization_id, id),
  constraint tasks_org_source_record_unique unique (organization_id, source_record_id),
  constraint tasks_org_source_record_fk
    foreign key (organization_id, source_record_id)
    references public.source_records (organization_id, id)
    on delete restrict on update restrict,
  constraint tasks_name_not_blank check (length(btrim(name)) > 0),
  constraint tasks_canonical_schema_version_positive check (canonical_schema_version > 0)
);
--> statement-breakpoint

create index tasks_org_completed_due_index on public.tasks (organization_id, completed, due_at);
--> statement-breakpoint

alter table public.tasks enable row level security;
--> statement-breakpoint
alter table public.tasks force row level security;
--> statement-breakpoint

create policy tasks_tenant_select on public.tasks
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy tasks_tenant_insert on public.tasks
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- Supabase's PostgREST default-grants anon/authenticated on new public
-- tables (see sql/provision_app_role.sql's header) — strip those
-- explicitly, same as every other tenant table.
revoke all on public.tasks from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update on public.tasks to app_runtime;
