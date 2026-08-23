CREATE INDEX "agent_collaborations_org_actor_membership_index" ON "agent_collaborations" USING btree ("organization_id","triggered_by_membership_id");--> statement-breakpoint
CREATE INDEX "card_feedback_org_membership_index" ON "card_feedback" USING btree ("organization_id","membership_id");--> statement-breakpoint
CREATE INDEX "goals_org_owner_membership_index" ON "goals" USING btree ("organization_id","owner_membership_id");--> statement-breakpoint
CREATE INDEX "organization_invites_org_invited_by_index" ON "organization_invites" USING btree ("organization_id","invited_by_membership_id");--> statement-breakpoint
CREATE INDEX "organization_subscription_addons_plan_addon_id_index" ON "organization_subscription_addons" USING btree ("plan_addon_id");--> statement-breakpoint
CREATE INDEX "organization_subscriptions_plan_id_index" ON "organization_subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "organization_subscriptions_plan_price_id_index" ON "organization_subscriptions" USING btree ("plan_price_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_org_integration_source_index" ON "sync_jobs" USING btree ("organization_id","integration_id","source_system");--> statement-breakpoint
CREATE INDEX "tasks_org_owner_membership_index" ON "tasks" USING btree ("organization_id","owner_membership_id");--> statement-breakpoint

-- Supabase's auth_rls_initplan advisor: these 3 policies (all created
-- after migration 0015 established the fix) still called
-- current_setting('app.current_organization_id', true) directly per row.
-- Wrapping the call in a scalar subquery lets Postgres hoist it into an
-- initplan evaluated once per statement. Same semantics, cheaper plan.
drop policy if exists internal_cost_events_tenant_isolation on public.internal_cost_events;
--> statement-breakpoint
create policy internal_cost_events_tenant_isolation on public.internal_cost_events
  for all
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists organization_subscriptions_tenant_isolation on public.organization_subscriptions;
--> statement-breakpoint
create policy organization_subscriptions_tenant_isolation on public.organization_subscriptions
  for all
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint
drop policy if exists organization_subscription_addons_tenant_isolation on public.organization_subscription_addons;
--> statement-breakpoint
create policy organization_subscription_addons_tenant_isolation on public.organization_subscription_addons
  for all
  using (
    exists (
      select 1
      from public.organization_subscriptions
      where organization_subscriptions.id = organization_subscription_addons.organization_subscription_id
        and organization_subscriptions.organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
    )
  )
  with check (
    exists (
      select 1
      from public.organization_subscriptions
      where organization_subscriptions.id = organization_subscription_addons.organization_subscription_id
        and organization_subscriptions.organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
    )
  );