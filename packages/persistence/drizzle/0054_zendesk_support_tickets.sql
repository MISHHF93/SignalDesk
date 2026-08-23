CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"priority" text,
	"requester_name" text,
	"assignee_name" text,
	"owner_membership_id" uuid,
	"due_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone NOT NULL,
	"canonical_schema_version" integer NOT NULL,
	"normalization_version" text NOT NULL,
	"normalized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "support_tickets_org_source_record_unique" UNIQUE("organization_id","source_record_id"),
	CONSTRAINT "support_tickets_subject_not_blank" CHECK (length(btrim("support_tickets"."subject")) > 0),
	CONSTRAINT "support_tickets_status_allowed" CHECK ("support_tickets"."status" in ('new', 'open', 'pending', 'hold', 'solved', 'closed')),
	CONSTRAINT "support_tickets_priority_allowed" CHECK ("support_tickets"."priority" is null or "support_tickets"."priority" in ('urgent', 'high', 'normal', 'low')),
	CONSTRAINT "support_tickets_canonical_schema_version_positive" CHECK ("support_tickets"."canonical_schema_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "sync_jobs" DROP CONSTRAINT "sync_jobs_entity_type_allowed";--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_org_source_record_fk" FOREIGN KEY ("organization_id","source_record_id") REFERENCES "public"."source_records"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_org_owner_membership_fk" FOREIGN KEY ("organization_id","owner_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "support_tickets_org_status_activity_index" ON "support_tickets" USING btree ("organization_id","status","last_activity_at");--> statement-breakpoint
CREATE INDEX "support_tickets_org_owner_membership_index" ON "support_tickets" USING btree ("organization_id","owner_membership_id");--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_entity_type_allowed" CHECK ("sync_jobs"."entity_type" in ('lead', 'invoice', 'payment', 'task', 'message', 'support_ticket'));
--> statement-breakpoint

-- Real Zendesk support ticket ingestion (implementation roadmap, docs/adr/
-- 0054-zendesk-support-ticket-ingestion.md) — the first support-domain
-- entity in this Business Graph. Standard tenant RLS, same shape as
-- tasks/leads/invoices/messages: append-only in application code (no
-- update path exists), select+insert+update granted to app_runtime for
-- consistency with those tables' own grants even though update is unused
-- today.

alter table public.support_tickets enable row level security;
--> statement-breakpoint
alter table public.support_tickets force row level security;
--> statement-breakpoint

create policy support_tickets_tenant_select on public.support_tickets
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy support_tickets_tenant_insert on public.support_tickets
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.support_tickets from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update on public.support_tickets to app_runtime;