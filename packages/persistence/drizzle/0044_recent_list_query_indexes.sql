CREATE INDEX "agent_collaborations_org_started_at_index" ON "agent_collaborations" USING btree ("organization_id","started_at");--> statement-breakpoint
CREATE INDEX "agent_delegation_grants_org_created_at_index" ON "agent_delegation_grants" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "card_feedback_org_created_at_index" ON "card_feedback" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "goals_org_created_at_index" ON "goals" USING btree ("organization_id","created_at");