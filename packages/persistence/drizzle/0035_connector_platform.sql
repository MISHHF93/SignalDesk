-- Connector platform (docs/adr/0021-connector-platform.md): sync_jobs
-- tracks each real sync run for the three connectors with real
-- sync-on-connect (HubSpot, QuickBooks, Asana) — status, item counts,
-- timing, and a computed cursor value, without wiring that cursor into
-- the fetch query yet. integrations gains enabled_capability_ids for the
-- new (currently UI-less) ConnectorSettings primitive.

CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"source_system" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"items_ingested" integer DEFAULT 0 NOT NULL,
	"items_skipped" integer DEFAULT 0 NOT NULL,
	"cursor_before" text,
	"cursor_after" text,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "sync_jobs_source_system_not_blank" CHECK (length(btrim("sync_jobs"."source_system")) > 0),
	CONSTRAINT "sync_jobs_trigger_allowed" CHECK ("sync_jobs"."trigger" in ('initial', 'manual')),
	CONSTRAINT "sync_jobs_status_allowed" CHECK ("sync_jobs"."status" in ('running', 'succeeded', 'failed')),
	CONSTRAINT "sync_jobs_items_ingested_nonnegative" CHECK ("sync_jobs"."items_ingested" >= 0),
	CONSTRAINT "sync_jobs_items_skipped_nonnegative" CHECK ("sync_jobs"."items_skipped" >= 0)
);
--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "enabled_capability_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_org_integration_source_fk" FOREIGN KEY ("organization_id","integration_id","source_system") REFERENCES "public"."integrations"("organization_id","id","source_system") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "sync_jobs_org_integration_started_index" ON "sync_jobs" USING btree ("organization_id","integration_id","started_at");
--> statement-breakpoint

-- Same forced-RLS/tenant-policy/least-privilege-grant treatment as every
-- other tenant table (0030_tasks.sql is the direct template). Update
-- (not just select/insert) is needed here, unlike most append-only tenant
-- tables: a job transitions running -> succeeded/failed after creation.

alter table public.sync_jobs enable row level security;
--> statement-breakpoint
alter table public.sync_jobs force row level security;
--> statement-breakpoint

create policy sync_jobs_tenant_select on public.sync_jobs
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy sync_jobs_tenant_insert on public.sync_jobs
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy sync_jobs_tenant_update on public.sync_jobs
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.sync_jobs from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update on public.sync_jobs to app_runtime;