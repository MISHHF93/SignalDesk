CREATE TABLE "internal_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"source_card_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "internal_tasks_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "internal_tasks_title_not_blank" CHECK (length(btrim("internal_tasks"."title")) > 0),
	CONSTRAINT "internal_tasks_status_allowed" CHECK ("internal_tasks"."status" in ('open', 'completed'))
);
--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "internal_tasks_org_status_index" ON "internal_tasks" USING btree ("organization_id","status");
--> statement-breakpoint

-- Tenant isolation, least-capability policies, and immutable provenance for
-- internal_tasks, matching the pattern established in
-- 0001_tenant_rls_policies.sql / 0003_harden_tenant_provenance.sql: the
-- application role must not own this table, be a superuser, or have
-- BYPASSRLS, and must set app.current_organization_id locally per
-- transaction (see packages/persistence/src/tenant-context.ts).
alter table public.internal_tasks enable row level security;
--> statement-breakpoint
alter table public.internal_tasks force row level security;
--> statement-breakpoint

create policy internal_tasks_tenant_select on public.internal_tasks
  for select
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy internal_tasks_tenant_insert on public.internal_tasks
  for insert
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy internal_tasks_tenant_update on public.internal_tasks
  for update
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

-- title/description/status/updated_at may change (a task's content and
-- lifecycle); identity and provenance columns may not.
create trigger internal_tasks_immutable_identity
before update on public.internal_tasks
for each row execute function public.reject_immutable_column_update(
  'id', 'organization_id', 'source_card_id', 'created_at'
);