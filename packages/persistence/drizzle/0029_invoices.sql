-- Real invoice sync (QuickBooks): a second connector-fed entity type
-- alongside leads, same shape — a normalized table downstream of
-- source_records, append-only for app_runtime, one row per synced
-- invoice. Mirrors public.leads exactly (see 0000/0001/0003/0015's
-- comments for why this shape: provenance via source_record_id, tenant
-- isolation via forced RLS, select+insert-only grants since there is no
-- real re-sync/update path yet).

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_record_id uuid not null,
  customer_name text not null,
  amount_cents bigint not null,
  currency text not null,
  due_at timestamptz not null,
  status text not null,
  canonical_schema_version integer not null,
  normalization_version text not null,
  normalized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_org_id_id_unique unique (organization_id, id),
  constraint invoices_org_source_record_unique unique (organization_id, source_record_id),
  constraint invoices_org_source_record_fk
    foreign key (organization_id, source_record_id)
    references public.source_records (organization_id, id)
    on delete restrict on update restrict,
  constraint invoices_customer_name_not_blank check (length(btrim(customer_name)) > 0),
  constraint invoices_amount_nonnegative check (amount_cents >= 0),
  constraint invoices_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint invoices_status_allowed check (status in ('open', 'paid', 'void')),
  constraint invoices_canonical_schema_version_positive check (canonical_schema_version > 0)
);
--> statement-breakpoint

create index invoices_org_status_due_index on public.invoices (organization_id, status, due_at);
--> statement-breakpoint

alter table public.invoices enable row level security;
--> statement-breakpoint
alter table public.invoices force row level security;
--> statement-breakpoint

create policy invoices_tenant_select on public.invoices
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy invoices_tenant_insert on public.invoices
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- Supabase's PostgREST default-grants anon/authenticated on new public
-- tables (see sql/provision_app_role.sql's header) — strip those
-- explicitly, same as every other tenant table.
revoke all on public.invoices from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update on public.invoices to app_runtime;
