-- Connector write actions expansion (docs/adr/0057-connector-write-actions-
-- expansion.md): extends the ADR 0056 draft->approve->send pattern from
-- Gmail to QuickBooks, Asana, HubSpot, and Zendesk. Generalizes
-- agent_collaborations' single-entity columns from Gmail-only
-- (message_id/drafted_reply_subject/drafted_reply_body) to five parallel
-- entity-id columns (message_id/invoice_id/task_id/lead_id/
-- support_ticket_id) and generic drafted_content_subject/
-- drafted_content_body columns, widens the pattern-consistency check to a
-- count across all five entity columns, and adds four new send-execution
-- tables (quickbooks_invoice_reminders/asana_task_nudges/hubspot_deal_notes/
-- zendesk_ticket_replies) — the exact same pending/sent/failed shape as
-- customer_email_replies, one per connector, kept deliberately separate
-- rather than one polymorphic table so each keeps a real FK to its own
-- parent entity.

ALTER TABLE "agent_collaborations" DROP CONSTRAINT "agent_collaborations_message_pattern_consistent";--> statement-breakpoint
ALTER TABLE "agent_collaborations" DROP CONSTRAINT "agent_collaborations_drafted_reply_consistent";--> statement-breakpoint
ALTER TABLE "agent_collaborations" RENAME COLUMN "drafted_reply_subject" TO "drafted_content_subject";--> statement-breakpoint
ALTER TABLE "agent_collaborations" RENAME COLUMN "drafted_reply_body" TO "drafted_content_body";--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD COLUMN "task_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD COLUMN "support_ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_task_results" RENAME COLUMN "drafted_reply" TO "drafted_content";--> statement-breakpoint

ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_org_invoice_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."invoices"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_org_task_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_org_lead_fk" FOREIGN KEY ("organization_id","lead_id") REFERENCES "public"."leads"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_org_support_ticket_fk" FOREIGN KEY ("organization_id","support_ticket_id") REFERENCES "public"."support_tickets"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint

CREATE INDEX "agent_collaborations_org_invoice_index" ON "agent_collaborations" USING btree ("organization_id","invoice_id");--> statement-breakpoint
CREATE INDEX "agent_collaborations_org_task_index" ON "agent_collaborations" USING btree ("organization_id","task_id");--> statement-breakpoint
CREATE INDEX "agent_collaborations_org_lead_index" ON "agent_collaborations" USING btree ("organization_id","lead_id");--> statement-breakpoint
CREATE INDEX "agent_collaborations_org_support_ticket_index" ON "agent_collaborations" USING btree ("organization_id","support_ticket_id");--> statement-breakpoint

-- Widened from a single messageId/pattern equality (ADR 0056) to a count
-- across all five entity-id columns: a 'single_specialist' row must set
-- EXACTLY ONE, a 'parallel_specialists' row must set NONE. A naive
-- (pattern = 'single_specialist') = (count <> 0) would wrongly allow 2+ ids
-- set at once — this counts precisely instead.
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_entity_pattern_consistent" CHECK (
  (case when "agent_collaborations"."pattern" = 'single_specialist' then 1 else 0 end) =
  (case when "agent_collaborations"."message_id" is not null then 1 else 0 end +
   case when "agent_collaborations"."invoice_id" is not null then 1 else 0 end +
   case when "agent_collaborations"."task_id" is not null then 1 else 0 end +
   case when "agent_collaborations"."lead_id" is not null then 1 else 0 end +
   case when "agent_collaborations"."support_ticket_id" is not null then 1 else 0 end)
);--> statement-breakpoint
-- subject implies body, but a body-only draft (Asana/HubSpot/Zendesk
-- comment or note) is valid on its own — unlike the old Gmail-only equality
-- check, subject and body are no longer required in lockstep.
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_drafted_content_consistent" CHECK ("agent_collaborations"."drafted_content_subject" is null or "agent_collaborations"."drafted_content_body" is not null);
--> statement-breakpoint

CREATE TABLE "quickbooks_invoice_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_collaboration_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"triggered_by_membership_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"failure_reason" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quickbooks_invoice_reminders_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "quickbooks_invoice_reminders_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "quickbooks_invoice_reminders_status_allowed" CHECK ("quickbooks_invoice_reminders"."status" in ('pending', 'sent', 'failed')),
	CONSTRAINT "quickbooks_invoice_reminders_idempotency_key_not_blank" CHECK (length(btrim("quickbooks_invoice_reminders"."idempotency_key")) > 0),
	CONSTRAINT "quickbooks_invoice_reminders_subject_not_blank" CHECK (length(btrim("quickbooks_invoice_reminders"."subject")) > 0),
	CONSTRAINT "quickbooks_invoice_reminders_body_not_blank" CHECK (length(btrim("quickbooks_invoice_reminders"."body")) > 0),
	CONSTRAINT "quickbooks_invoice_reminders_sent_consistent" CHECK (("quickbooks_invoice_reminders"."status" = 'sent' and "quickbooks_invoice_reminders"."sent_at" is not null) or ("quickbooks_invoice_reminders"."status" != 'sent')),
	CONSTRAINT "quickbooks_invoice_reminders_failed_consistent" CHECK (("quickbooks_invoice_reminders"."status" = 'failed' and "quickbooks_invoice_reminders"."failure_reason" is not null) or ("quickbooks_invoice_reminders"."status" != 'failed'))
);
--> statement-breakpoint
ALTER TABLE "quickbooks_invoice_reminders" ADD CONSTRAINT "quickbooks_invoice_reminders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_invoice_reminders" ADD CONSTRAINT "quickbooks_invoice_reminders_org_collaboration_fk" FOREIGN KEY ("organization_id","agent_collaboration_id") REFERENCES "public"."agent_collaborations"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "quickbooks_invoice_reminders" ADD CONSTRAINT "quickbooks_invoice_reminders_org_invoice_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."invoices"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "quickbooks_invoice_reminders" ADD CONSTRAINT "quickbooks_invoice_reminders_org_membership_fk" FOREIGN KEY ("organization_id","triggered_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "quickbooks_invoice_reminders_org_collaboration_index" ON "quickbooks_invoice_reminders" USING btree ("organization_id","agent_collaboration_id");--> statement-breakpoint
CREATE INDEX "quickbooks_invoice_reminders_org_invoice_index" ON "quickbooks_invoice_reminders" USING btree ("organization_id","invoice_id");--> statement-breakpoint
CREATE INDEX "quickbooks_invoice_reminders_org_membership_index" ON "quickbooks_invoice_reminders" USING btree ("organization_id","triggered_by_membership_id");--> statement-breakpoint

CREATE TABLE "asana_task_nudges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_collaboration_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"triggered_by_membership_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"body" text NOT NULL,
	"asana_story_gid" text,
	"failure_reason" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asana_task_nudges_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "asana_task_nudges_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "asana_task_nudges_status_allowed" CHECK ("asana_task_nudges"."status" in ('pending', 'sent', 'failed')),
	CONSTRAINT "asana_task_nudges_idempotency_key_not_blank" CHECK (length(btrim("asana_task_nudges"."idempotency_key")) > 0),
	CONSTRAINT "asana_task_nudges_body_not_blank" CHECK (length(btrim("asana_task_nudges"."body")) > 0),
	CONSTRAINT "asana_task_nudges_sent_consistent" CHECK (("asana_task_nudges"."status" = 'sent' and "asana_task_nudges"."asana_story_gid" is not null and "asana_task_nudges"."sent_at" is not null) or ("asana_task_nudges"."status" != 'sent')),
	CONSTRAINT "asana_task_nudges_failed_consistent" CHECK (("asana_task_nudges"."status" = 'failed' and "asana_task_nudges"."failure_reason" is not null) or ("asana_task_nudges"."status" != 'failed'))
);
--> statement-breakpoint
ALTER TABLE "asana_task_nudges" ADD CONSTRAINT "asana_task_nudges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asana_task_nudges" ADD CONSTRAINT "asana_task_nudges_org_collaboration_fk" FOREIGN KEY ("organization_id","agent_collaboration_id") REFERENCES "public"."agent_collaborations"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "asana_task_nudges" ADD CONSTRAINT "asana_task_nudges_org_task_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "asana_task_nudges" ADD CONSTRAINT "asana_task_nudges_org_membership_fk" FOREIGN KEY ("organization_id","triggered_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "asana_task_nudges_org_collaboration_index" ON "asana_task_nudges" USING btree ("organization_id","agent_collaboration_id");--> statement-breakpoint
CREATE INDEX "asana_task_nudges_org_task_index" ON "asana_task_nudges" USING btree ("organization_id","task_id");--> statement-breakpoint
CREATE INDEX "asana_task_nudges_org_membership_index" ON "asana_task_nudges" USING btree ("organization_id","triggered_by_membership_id");--> statement-breakpoint

CREATE TABLE "hubspot_deal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_collaboration_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"triggered_by_membership_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"body" text NOT NULL,
	"hubspot_note_id" text,
	"failure_reason" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hubspot_deal_notes_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "hubspot_deal_notes_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "hubspot_deal_notes_status_allowed" CHECK ("hubspot_deal_notes"."status" in ('pending', 'sent', 'failed')),
	CONSTRAINT "hubspot_deal_notes_idempotency_key_not_blank" CHECK (length(btrim("hubspot_deal_notes"."idempotency_key")) > 0),
	CONSTRAINT "hubspot_deal_notes_body_not_blank" CHECK (length(btrim("hubspot_deal_notes"."body")) > 0),
	CONSTRAINT "hubspot_deal_notes_sent_consistent" CHECK (("hubspot_deal_notes"."status" = 'sent' and "hubspot_deal_notes"."hubspot_note_id" is not null and "hubspot_deal_notes"."sent_at" is not null) or ("hubspot_deal_notes"."status" != 'sent')),
	CONSTRAINT "hubspot_deal_notes_failed_consistent" CHECK (("hubspot_deal_notes"."status" = 'failed' and "hubspot_deal_notes"."failure_reason" is not null) or ("hubspot_deal_notes"."status" != 'failed'))
);
--> statement-breakpoint
ALTER TABLE "hubspot_deal_notes" ADD CONSTRAINT "hubspot_deal_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubspot_deal_notes" ADD CONSTRAINT "hubspot_deal_notes_org_collaboration_fk" FOREIGN KEY ("organization_id","agent_collaboration_id") REFERENCES "public"."agent_collaborations"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "hubspot_deal_notes" ADD CONSTRAINT "hubspot_deal_notes_org_lead_fk" FOREIGN KEY ("organization_id","lead_id") REFERENCES "public"."leads"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "hubspot_deal_notes" ADD CONSTRAINT "hubspot_deal_notes_org_membership_fk" FOREIGN KEY ("organization_id","triggered_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "hubspot_deal_notes_org_collaboration_index" ON "hubspot_deal_notes" USING btree ("organization_id","agent_collaboration_id");--> statement-breakpoint
CREATE INDEX "hubspot_deal_notes_org_lead_index" ON "hubspot_deal_notes" USING btree ("organization_id","lead_id");--> statement-breakpoint
CREATE INDEX "hubspot_deal_notes_org_membership_index" ON "hubspot_deal_notes" USING btree ("organization_id","triggered_by_membership_id");--> statement-breakpoint

CREATE TABLE "zendesk_ticket_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_collaboration_id" uuid NOT NULL,
	"support_ticket_id" uuid NOT NULL,
	"triggered_by_membership_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"body" text NOT NULL,
	"failure_reason" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zendesk_ticket_replies_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "zendesk_ticket_replies_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "zendesk_ticket_replies_status_allowed" CHECK ("zendesk_ticket_replies"."status" in ('pending', 'sent', 'failed')),
	CONSTRAINT "zendesk_ticket_replies_idempotency_key_not_blank" CHECK (length(btrim("zendesk_ticket_replies"."idempotency_key")) > 0),
	CONSTRAINT "zendesk_ticket_replies_body_not_blank" CHECK (length(btrim("zendesk_ticket_replies"."body")) > 0),
	CONSTRAINT "zendesk_ticket_replies_sent_consistent" CHECK (("zendesk_ticket_replies"."status" = 'sent' and "zendesk_ticket_replies"."sent_at" is not null) or ("zendesk_ticket_replies"."status" != 'sent')),
	CONSTRAINT "zendesk_ticket_replies_failed_consistent" CHECK (("zendesk_ticket_replies"."status" = 'failed' and "zendesk_ticket_replies"."failure_reason" is not null) or ("zendesk_ticket_replies"."status" != 'failed'))
);
--> statement-breakpoint
ALTER TABLE "zendesk_ticket_replies" ADD CONSTRAINT "zendesk_ticket_replies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zendesk_ticket_replies" ADD CONSTRAINT "zendesk_ticket_replies_org_collaboration_fk" FOREIGN KEY ("organization_id","agent_collaboration_id") REFERENCES "public"."agent_collaborations"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "zendesk_ticket_replies" ADD CONSTRAINT "zendesk_ticket_replies_org_support_ticket_fk" FOREIGN KEY ("organization_id","support_ticket_id") REFERENCES "public"."support_tickets"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "zendesk_ticket_replies" ADD CONSTRAINT "zendesk_ticket_replies_org_membership_fk" FOREIGN KEY ("organization_id","triggered_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "zendesk_ticket_replies_org_collaboration_index" ON "zendesk_ticket_replies" USING btree ("organization_id","agent_collaboration_id");--> statement-breakpoint
CREATE INDEX "zendesk_ticket_replies_org_support_ticket_index" ON "zendesk_ticket_replies" USING btree ("organization_id","support_ticket_id");--> statement-breakpoint
CREATE INDEX "zendesk_ticket_replies_org_membership_index" ON "zendesk_ticket_replies" USING btree ("organization_id","triggered_by_membership_id");
--> statement-breakpoint

-- Same forced-RLS/tenant-policy/least-privilege-grant treatment as
-- customer_email_replies (0059_message_reply_send.sql) — select/insert/
-- update, since a row's status transitions from 'pending' to 'sent'/
-- 'failed' after creation. Repeated once per new table.

alter table public.quickbooks_invoice_reminders enable row level security;
--> statement-breakpoint
alter table public.quickbooks_invoice_reminders force row level security;
--> statement-breakpoint
create policy quickbooks_invoice_reminders_tenant_select on public.quickbooks_invoice_reminders
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
create policy quickbooks_invoice_reminders_tenant_insert on public.quickbooks_invoice_reminders
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
create policy quickbooks_invoice_reminders_tenant_update on public.quickbooks_invoice_reminders
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
revoke all on public.quickbooks_invoice_reminders from public, anon, authenticated;
--> statement-breakpoint
grant select, insert, update on public.quickbooks_invoice_reminders to app_runtime;
--> statement-breakpoint

alter table public.asana_task_nudges enable row level security;
--> statement-breakpoint
alter table public.asana_task_nudges force row level security;
--> statement-breakpoint
create policy asana_task_nudges_tenant_select on public.asana_task_nudges
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
create policy asana_task_nudges_tenant_insert on public.asana_task_nudges
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
create policy asana_task_nudges_tenant_update on public.asana_task_nudges
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
revoke all on public.asana_task_nudges from public, anon, authenticated;
--> statement-breakpoint
grant select, insert, update on public.asana_task_nudges to app_runtime;
--> statement-breakpoint

alter table public.hubspot_deal_notes enable row level security;
--> statement-breakpoint
alter table public.hubspot_deal_notes force row level security;
--> statement-breakpoint
create policy hubspot_deal_notes_tenant_select on public.hubspot_deal_notes
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
create policy hubspot_deal_notes_tenant_insert on public.hubspot_deal_notes
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
create policy hubspot_deal_notes_tenant_update on public.hubspot_deal_notes
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
revoke all on public.hubspot_deal_notes from public, anon, authenticated;
--> statement-breakpoint
grant select, insert, update on public.hubspot_deal_notes to app_runtime;
--> statement-breakpoint

alter table public.zendesk_ticket_replies enable row level security;
--> statement-breakpoint
alter table public.zendesk_ticket_replies force row level security;
--> statement-breakpoint
create policy zendesk_ticket_replies_tenant_select on public.zendesk_ticket_replies
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
create policy zendesk_ticket_replies_tenant_insert on public.zendesk_ticket_replies
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
create policy zendesk_ticket_replies_tenant_update on public.zendesk_ticket_replies
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
revoke all on public.zendesk_ticket_replies from public, anon, authenticated;
--> statement-breakpoint
grant select, insert, update on public.zendesk_ticket_replies to app_runtime;
