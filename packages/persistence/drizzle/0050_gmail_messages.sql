CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"lead_id" uuid,
	"external_thread_id" text NOT NULL,
	"direction" text NOT NULL,
	"counterparty_email" text NOT NULL,
	"counterparty_name" text,
	"subject" text NOT NULL,
	"snippet" text,
	"body_preview" text,
	"body_truncated" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"retain_until" timestamp with time zone,
	"canonical_schema_version" integer NOT NULL,
	"normalization_version" text NOT NULL,
	"normalized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "messages_org_source_record_unique" UNIQUE("organization_id","source_record_id"),
	CONSTRAINT "messages_direction_allowed" CHECK ("messages"."direction" in ('inbound', 'outbound')),
	CONSTRAINT "messages_external_thread_id_not_blank" CHECK (length(btrim("messages"."external_thread_id")) > 0),
	CONSTRAINT "messages_counterparty_email_not_blank" CHECK (length(btrim("messages"."counterparty_email")) > 0),
	CONSTRAINT "messages_subject_not_blank" CHECK (length(btrim("messages"."subject")) > 0),
	CONSTRAINT "messages_canonical_schema_version_positive" CHECK ("messages"."canonical_schema_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "sync_jobs" DROP CONSTRAINT "sync_jobs_entity_type_allowed";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_org_source_record_fk" FOREIGN KEY ("organization_id","source_record_id") REFERENCES "public"."source_records"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_org_lead_fk" FOREIGN KEY ("organization_id","lead_id") REFERENCES "public"."leads"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "messages_org_occurred_at_index" ON "messages" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "messages_org_thread_occurred_index" ON "messages" USING btree ("organization_id","external_thread_id","occurred_at");--> statement-breakpoint
CREATE INDEX "messages_org_lead_index" ON "messages" USING btree ("organization_id","lead_id");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_email_not_blank_when_present" CHECK ("leads"."contact_email" is null or length(btrim("leads"."contact_email")) > 0);--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_entity_type_allowed" CHECK ("sync_jobs"."entity_type" in ('lead', 'invoice', 'payment', 'task', 'message'));
--> statement-breakpoint

-- Real Gmail message ingestion (Phase 4b, implementation roadmap,
-- docs/adr/0050-gmail-message-ingestion.md) — the first canonical entity
-- whose stored content is close to its raw source content rather than a
-- small structured summary. Standard tenant RLS, same shape as
-- tasks/leads/invoices: append-only in application code (no update path
-- exists — Gmail messages are immutable once received), select+insert+
-- update granted to app_runtime for consistency with those tables' own
-- grants even though update is unused today.

alter table public.messages enable row level security;
--> statement-breakpoint
alter table public.messages force row level security;
--> statement-breakpoint

create policy messages_tenant_select on public.messages
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy messages_tenant_insert on public.messages
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.messages from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update on public.messages to app_runtime;