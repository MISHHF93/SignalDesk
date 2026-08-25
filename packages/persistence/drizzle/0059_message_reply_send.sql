-- Message reply send (docs/adr/0056-message-reply-send.md): the Agent
-- Fabric's second real action type, and the first that executes against a
-- real external system (Gmail) instead of only this database. Widens
-- agent_collaborations with a nullable message_id/drafted_reply_subject/
-- drafted_reply_body for the new 'single_specialist' pattern (one message,
-- one specialist, drafting one reply) alongside the existing
-- 'parallel_specialists' business-wide sweep; widens agent_task_results
-- with a nullable drafted_reply for the new draft_customer_reply
-- capability's result; and adds customer_email_replies as the durable
-- send-execution record — the same tenant-scoped, idempotent shape
-- internal_tasks already established, but with a pending/sent/failed
-- lifecycle instead of a single insert, since the real Gmail API call
-- can't happen inside this transaction.

CREATE TABLE "customer_email_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_collaboration_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"triggered_by_membership_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"gmail_message_id" text,
	"gmail_thread_id" text,
	"failure_reason" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_email_replies_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "customer_email_replies_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "customer_email_replies_status_allowed" CHECK ("customer_email_replies"."status" in ('pending', 'sent', 'failed')),
	CONSTRAINT "customer_email_replies_idempotency_key_not_blank" CHECK (length(btrim("customer_email_replies"."idempotency_key")) > 0),
	CONSTRAINT "customer_email_replies_to_email_not_blank" CHECK (length(btrim("customer_email_replies"."to_email")) > 0),
	CONSTRAINT "customer_email_replies_subject_not_blank" CHECK (length(btrim("customer_email_replies"."subject")) > 0),
	CONSTRAINT "customer_email_replies_body_not_blank" CHECK (length(btrim("customer_email_replies"."body")) > 0),
	CONSTRAINT "customer_email_replies_sent_consistent" CHECK (("customer_email_replies"."status" = 'sent' and "customer_email_replies"."gmail_message_id" is not null and "customer_email_replies"."gmail_thread_id" is not null and "customer_email_replies"."sent_at" is not null) or ("customer_email_replies"."status" != 'sent')),
	CONSTRAINT "customer_email_replies_failed_consistent" CHECK (("customer_email_replies"."status" = 'failed' and "customer_email_replies"."failure_reason" is not null) or ("customer_email_replies"."status" != 'failed'))
);
--> statement-breakpoint
ALTER TABLE "agent_collaborations" DROP CONSTRAINT "agent_collaborations_pattern_allowed";--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD COLUMN "message_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD COLUMN "drafted_reply_subject" text;--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD COLUMN "drafted_reply_body" text;--> statement-breakpoint
ALTER TABLE "agent_task_results" ADD COLUMN "drafted_reply" jsonb;--> statement-breakpoint
ALTER TABLE "customer_email_replies" ADD CONSTRAINT "customer_email_replies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_email_replies" ADD CONSTRAINT "customer_email_replies_org_collaboration_fk" FOREIGN KEY ("organization_id","agent_collaboration_id") REFERENCES "public"."agent_collaborations"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "customer_email_replies" ADD CONSTRAINT "customer_email_replies_org_message_fk" FOREIGN KEY ("organization_id","message_id") REFERENCES "public"."messages"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "customer_email_replies" ADD CONSTRAINT "customer_email_replies_org_membership_fk" FOREIGN KEY ("organization_id","triggered_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "customer_email_replies_org_collaboration_index" ON "customer_email_replies" USING btree ("organization_id","agent_collaboration_id");--> statement-breakpoint
CREATE INDEX "customer_email_replies_org_message_index" ON "customer_email_replies" USING btree ("organization_id","message_id");--> statement-breakpoint
CREATE INDEX "customer_email_replies_org_membership_index" ON "customer_email_replies" USING btree ("organization_id","triggered_by_membership_id");--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_org_message_fk" FOREIGN KEY ("organization_id","message_id") REFERENCES "public"."messages"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "agent_collaborations_org_message_index" ON "agent_collaborations" USING btree ("organization_id","message_id");--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_message_pattern_consistent" CHECK (("agent_collaborations"."pattern" = 'single_specialist') = ("agent_collaborations"."message_id" is not null));--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_drafted_reply_consistent" CHECK (("agent_collaborations"."drafted_reply_subject" is null) = ("agent_collaborations"."drafted_reply_body" is null));--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_pattern_allowed" CHECK ("agent_collaborations"."pattern" in ('parallel_specialists', 'single_specialist'));
--> statement-breakpoint

-- Same forced-RLS/tenant-policy/least-privilege-grant treatment as every
-- other tenant table (0034_agent_fabric.sql's agent_collaborations is the
-- direct template — select/insert/update, since a row's status transitions
-- from 'pending' to 'sent'/'failed' after creation, the same real second
-- write agent_collaborations already needs).

alter table public.customer_email_replies enable row level security;
--> statement-breakpoint
alter table public.customer_email_replies force row level security;
--> statement-breakpoint

create policy customer_email_replies_tenant_select on public.customer_email_replies
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy customer_email_replies_tenant_insert on public.customer_email_replies
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy customer_email_replies_tenant_update on public.customer_email_replies
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.customer_email_replies from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update on public.customer_email_replies to app_runtime;