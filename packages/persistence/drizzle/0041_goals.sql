CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_membership_id" uuid NOT NULL,
	"metric_id" text NOT NULL,
	"name" text NOT NULL,
	"comparison_operator" text NOT NULL,
	"target_value" bigint NOT NULL,
	"currency" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "goals_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "goals_metric_id_allowed" CHECK ("goals"."metric_id" in ('accounts_receivable', 'overdue_receivable_exposure', 'pipeline_value', 'cash_collected_recent', 'open_task_backlog')),
	CONSTRAINT "goals_name_not_blank" CHECK (length(btrim("goals"."name")) > 0),
	CONSTRAINT "goals_comparison_operator_allowed" CHECK ("goals"."comparison_operator" in ('at_most', 'at_least')),
	CONSTRAINT "goals_target_value_nonnegative" CHECK ("goals"."target_value" >= 0),
	CONSTRAINT "goals_currency_format" CHECK ("goals"."currency" is null or "goals"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "goals_idempotency_key_not_blank" CHECK (length(btrim("goals"."idempotency_key")) > 0)
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_org_owner_membership_fk" FOREIGN KEY ("organization_id","owner_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "goals_org_metric_index" ON "goals" USING btree ("organization_id","metric_id");
--> statement-breakpoint

-- Same forced-RLS/tenant-policy/least-privilege-grant treatment as every
-- other tenant table (0040_card_feedback.sql is the direct template:
-- append-only, select+insert only, no update/delete).

alter table public.goals enable row level security;
--> statement-breakpoint
alter table public.goals force row level security;
--> statement-breakpoint

create policy goals_tenant_select on public.goals
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy goals_tenant_insert on public.goals
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.goals from public, anon, authenticated;
--> statement-breakpoint

grant select, insert on public.goals to app_runtime;