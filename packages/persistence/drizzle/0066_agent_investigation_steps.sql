-- The Work Mat's real, incrementally-updated progress record (ADR 0020's
-- amendment, docs/adr/0063-agent-investigation-progress.md): an ordered
-- child of one agent_collaborations row, written as runParallelSpecialists
-- actually progresses. See schema.ts's own doc comment on
-- agentInvestigationSteps for why this is a fourth child table rather than
-- a new top-level session concept.

CREATE TABLE "agent_investigation_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"collaboration_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_investigation_steps_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "agent_investigation_steps_collaboration_index_unique" UNIQUE("organization_id","collaboration_id","step_index"),
	CONSTRAINT "agent_investigation_steps_status_allowed" CHECK ("agent_investigation_steps"."status" in ('pending', 'running', 'done', 'failed')),
	CONSTRAINT "agent_investigation_steps_label_not_blank" CHECK (length(btrim("agent_investigation_steps"."label")) > 0),
	CONSTRAINT "agent_investigation_steps_step_index_not_negative" CHECK ("agent_investigation_steps"."step_index" >= 0),
	CONSTRAINT "agent_investigation_steps_timestamps_consistent" CHECK (
		("agent_investigation_steps"."status" = 'pending' and "agent_investigation_steps"."started_at" is null and "agent_investigation_steps"."completed_at" is null) or
		("agent_investigation_steps"."status" = 'running' and "agent_investigation_steps"."started_at" is not null and "agent_investigation_steps"."completed_at" is null) or
		("agent_investigation_steps"."status" in ('done', 'failed') and "agent_investigation_steps"."started_at" is not null and "agent_investigation_steps"."completed_at" is not null)
	)
);
--> statement-breakpoint

ALTER TABLE "agent_investigation_steps" ADD CONSTRAINT "agent_investigation_steps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "agent_investigation_steps" ADD CONSTRAINT "agent_investigation_steps_org_collaboration_fk" FOREIGN KEY ("organization_id","collaboration_id") REFERENCES "public"."agent_collaborations"("organization_id","id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint

CREATE INDEX "agent_investigation_steps_org_collaboration_index" ON "agent_investigation_steps" USING btree ("organization_id","collaboration_id");
--> statement-breakpoint

-- Same forced-RLS/tenant-policy/least-privilege-grant treatment as every
-- other tenant table (0034_agent_fabric.sql's agent_collaborations is the
-- direct template — including its update policy, since a step's status
-- transitions pending -> running -> done/failed after the row is created,
-- the same real second-write shape agent_collaborations itself needed).

alter table public.agent_investigation_steps enable row level security;
--> statement-breakpoint
alter table public.agent_investigation_steps force row level security;
--> statement-breakpoint

create policy agent_investigation_steps_tenant_select on public.agent_investigation_steps
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy agent_investigation_steps_tenant_insert on public.agent_investigation_steps
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy agent_investigation_steps_tenant_update on public.agent_investigation_steps
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.agent_investigation_steps from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update on public.agent_investigation_steps to app_runtime;
