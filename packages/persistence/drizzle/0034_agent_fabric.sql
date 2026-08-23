-- Agent Fabric (docs/adr/0020-agent-fabric.md): governed multi-agent
-- collaboration. Three new tenant tables — one collaboration ("investigate
-- risk") can fan out to N specialist task results under a capability grant
-- each — plus a widened audit_events.actor_kind so an agent-initiated call
-- can be attributed honestly (actor_kind='agent', actor_agent_id set)
-- instead of every audit row claiming a human did it.

CREATE TABLE "agent_collaborations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"triggered_by_membership_id" uuid NOT NULL,
	"pattern" text NOT NULL,
	"objective" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"reconciled_summary" text,
	"reconciled_confidence_basis_points" integer,
	"contradictions_detected" boolean DEFAULT false NOT NULL,
	"correlation_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_collaborations_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "agent_collaborations_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "agent_collaborations_pattern_allowed" CHECK ("agent_collaborations"."pattern" in ('parallel_specialists')),
	CONSTRAINT "agent_collaborations_status_allowed" CHECK ("agent_collaborations"."status" in ('running', 'completed', 'failed')),
	CONSTRAINT "agent_collaborations_objective_not_blank" CHECK (length(btrim("agent_collaborations"."objective")) > 0),
	CONSTRAINT "agent_collaborations_idempotency_key_not_blank" CHECK (length(btrim("agent_collaborations"."idempotency_key")) > 0),
	CONSTRAINT "agent_collaborations_confidence_range" CHECK ("agent_collaborations"."reconciled_confidence_basis_points" is null or ("agent_collaborations"."reconciled_confidence_basis_points" >= 0 and "agent_collaborations"."reconciled_confidence_basis_points" <= 10000)),
	CONSTRAINT "agent_collaborations_completion_consistent" CHECK (("agent_collaborations"."status" = 'running' and "agent_collaborations"."completed_at" is null) or ("agent_collaborations"."status" in ('completed', 'failed') and "agent_collaborations"."completed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "agent_delegation_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"collaboration_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"capability" text NOT NULL,
	"can_propose" boolean NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_delegation_grants_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "agent_delegation_grants_agent_id_not_blank" CHECK (length(btrim("agent_delegation_grants"."agent_id")) > 0),
	CONSTRAINT "agent_delegation_grants_expiry_after_creation" CHECK ("agent_delegation_grants"."expires_at" > "agent_delegation_grants"."created_at")
);
--> statement-breakpoint
CREATE TABLE "agent_task_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"collaboration_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"capability" text NOT NULL,
	"status" text NOT NULL,
	"claims" jsonb NOT NULL,
	"evidence_ids" jsonb NOT NULL,
	"confidence_basis_points" integer,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "agent_task_results_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "agent_task_results_status_allowed" CHECK ("agent_task_results"."status" in ('completed', 'abstained', 'failed')),
	CONSTRAINT "agent_task_results_agent_id_not_blank" CHECK (length(btrim("agent_task_results"."agent_id")) > 0),
	CONSTRAINT "agent_task_results_confidence_range" CHECK ("agent_task_results"."confidence_basis_points" is null or ("agent_task_results"."confidence_basis_points" >= 0 and "agent_task_results"."confidence_basis_points" <= 10000))
);
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_kind_allowed";--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_membership_consistent";--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_agent_id" text;--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_collaborations" ADD CONSTRAINT "agent_collaborations_org_actor_membership_fk" FOREIGN KEY ("organization_id","triggered_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "agent_delegation_grants" ADD CONSTRAINT "agent_delegation_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_delegation_grants" ADD CONSTRAINT "agent_delegation_grants_org_collaboration_fk" FOREIGN KEY ("organization_id","collaboration_id") REFERENCES "public"."agent_collaborations"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "agent_task_results" ADD CONSTRAINT "agent_task_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_results" ADD CONSTRAINT "agent_task_results_org_collaboration_fk" FOREIGN KEY ("organization_id","collaboration_id") REFERENCES "public"."agent_collaborations"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "agent_collaborations_org_status_index" ON "agent_collaborations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "agent_delegation_grants_org_collaboration_index" ON "agent_delegation_grants" USING btree ("organization_id","collaboration_id");--> statement-breakpoint
CREATE INDEX "agent_task_results_org_collaboration_index" ON "agent_task_results" USING btree ("organization_id","collaboration_id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_kind_allowed" CHECK ("audit_events"."actor_kind" in ('user', 'system', 'integration', 'agent'));--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_membership_consistent" CHECK (("audit_events"."actor_kind" = 'user' and "audit_events"."actor_membership_id" is not null and "audit_events"."actor_agent_id" is null) or ("audit_events"."actor_kind" = 'agent' and "audit_events"."actor_agent_id" is not null and "audit_events"."actor_membership_id" is null) or ("audit_events"."actor_kind" in ('system', 'integration') and "audit_events"."actor_membership_id" is null and "audit_events"."actor_agent_id" is null));
--> statement-breakpoint

-- Same forced-RLS/tenant-policy/least-privilege-grant treatment as every
-- other tenant table (0030_tasks.sql is the direct template).

alter table public.agent_collaborations enable row level security;
--> statement-breakpoint
alter table public.agent_collaborations force row level security;
--> statement-breakpoint

create policy agent_collaborations_tenant_select on public.agent_collaborations
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy agent_collaborations_tenant_insert on public.agent_collaborations
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

-- Update (not just select/insert), unlike every other tenant table so far:
-- completeAgentCollaboration transitions a row from 'running' to
-- 'completed'/'failed' after it was created — a real second write to the
-- same row, not append-only like internal_tasks/audit_events.
create policy agent_collaborations_tenant_update on public.agent_collaborations
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.agent_collaborations from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update on public.agent_collaborations to app_runtime;
--> statement-breakpoint

alter table public.agent_task_results enable row level security;
--> statement-breakpoint
alter table public.agent_task_results force row level security;
--> statement-breakpoint

create policy agent_task_results_tenant_select on public.agent_task_results
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy agent_task_results_tenant_insert on public.agent_task_results
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.agent_task_results from public, anon, authenticated;
--> statement-breakpoint

grant select, insert on public.agent_task_results to app_runtime;
--> statement-breakpoint

alter table public.agent_delegation_grants enable row level security;
--> statement-breakpoint
alter table public.agent_delegation_grants force row level security;
--> statement-breakpoint

create policy agent_delegation_grants_tenant_select on public.agent_delegation_grants
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy agent_delegation_grants_tenant_insert on public.agent_delegation_grants
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.agent_delegation_grants from public, anon, authenticated;
--> statement-breakpoint

grant select, insert on public.agent_delegation_grants to app_runtime;