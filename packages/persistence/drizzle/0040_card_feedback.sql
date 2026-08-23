CREATE TABLE "card_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"finding_id" text NOT NULL,
	"card_type" text NOT NULL,
	"feedback" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_feedback_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "card_feedback_finding_id_not_blank" CHECK (length(btrim("card_feedback"."finding_id")) > 0),
	CONSTRAINT "card_feedback_card_type_allowed" CHECK ("card_feedback"."card_type" in ('stuck', 'lead_risk', 'integration_health', 'invoice_risk', 'task_risk', 'agent_recommendation', 'payment_received')),
	CONSTRAINT "card_feedback_feedback_allowed" CHECK ("card_feedback"."feedback" in ('useful', 'not_relevant'))
);
--> statement-breakpoint
ALTER TABLE "card_feedback" ADD CONSTRAINT "card_feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_feedback" ADD CONSTRAINT "card_feedback_org_membership_fk" FOREIGN KEY ("organization_id","membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "card_feedback_org_finding_index" ON "card_feedback" USING btree ("organization_id","finding_id");
--> statement-breakpoint

-- Same forced-RLS/tenant-policy/least-privilege-grant treatment as every
-- other tenant table (0034_agent_fabric.sql's agent_task_results is the
-- direct template: append-only, select+insert only, no update/delete).

alter table public.card_feedback enable row level security;
--> statement-breakpoint
alter table public.card_feedback force row level security;
--> statement-breakpoint

create policy card_feedback_tenant_select on public.card_feedback
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy card_feedback_tenant_insert on public.card_feedback
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.card_feedback from public, anon, authenticated;
--> statement-breakpoint

grant select, insert on public.card_feedback to app_runtime;