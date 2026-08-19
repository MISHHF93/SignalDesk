-- The first real Artifact: a stored, retrievable work product assembled
-- from the Intelligence Core's own findings (see
-- packages/application/src/artifacts/daily-brief.ts) — real content, not
-- fabricated AI prose (this app has no model provider yet). Only
-- `daily_brief` exists; the type/status columns anticipate the fuller
-- artifact taxonomy and review/approval lifecycle the product intends
-- without building either before something real needs them, the same
-- precedent as `invoices.status` including `paid`/`void`.
--
-- Unlike leads/invoices/tasks, this is not a connector-fed entity — it has
-- no source_record_id/provenance chain to an external system; its
-- provenance is `source_finding_ids`, references into whatever the
-- Intelligence Core computed at generation time.

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,
  title text not null,
  status text not null default 'generated',
  generated_by text not null default 'deterministic-assembly',
  content text not null,
  structured_data jsonb not null default '{}'::jsonb,
  source_finding_ids text[] not null default '{}',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artifacts_type_allowed check (type in ('daily_brief')),
  constraint artifacts_status_allowed check (
    status in ('draft', 'generated', 'reviewed', 'approved', 'published', 'superseded', 'archived')
  ),
  constraint artifacts_generated_by_allowed check (generated_by in ('deterministic-assembly')),
  constraint artifacts_title_not_blank check (length(btrim(title)) > 0),
  constraint artifacts_content_not_blank check (length(btrim(content)) > 0)
);
--> statement-breakpoint

create index artifacts_org_type_generated_index on public.artifacts (organization_id, type, generated_at);
--> statement-breakpoint

alter table public.artifacts enable row level security;
--> statement-breakpoint
alter table public.artifacts force row level security;
--> statement-breakpoint

create policy artifacts_tenant_select on public.artifacts
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy artifacts_tenant_insert on public.artifacts
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- Supabase's PostgREST default-grants anon/authenticated on new public
-- tables (see sql/provision_app_role.sql's header) — strip those
-- explicitly, same as every other tenant table.
revoke all on public.artifacts from public, anon, authenticated;
--> statement-breakpoint

-- Select + insert only: v1 never transitions an artifact's status (no
-- review/approval flow exists yet to drive draft -> reviewed -> approved),
-- so there is no real UPDATE path to grant — unlike leads/invoices/tasks,
-- which follow the batch "append-mostly business tables" grant even
-- though they don't update either, this table's lack of an update grant
-- is a deliberate, narrower choice, not just precedent-following.
grant select, insert on public.artifacts to app_runtime;
