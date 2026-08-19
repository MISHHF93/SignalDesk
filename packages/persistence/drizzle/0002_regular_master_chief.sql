CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_system" text NOT NULL,
	"external_account_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_org_id_source_system_unique" UNIQUE("organization_id","id","source_system"),
	CONSTRAINT "integrations_org_source_account_unique" UNIQUE("organization_id","source_system","external_account_id"),
	CONSTRAINT "integrations_source_system_not_blank" CHECK (length(btrim("integrations"."source_system")) > 0),
	CONSTRAINT "integrations_external_account_id_not_blank" CHECK (length(btrim("integrations"."external_account_id")) > 0),
	CONSTRAINT "integrations_status_allowed" CHECK ("integrations"."status" in ('pending', 'active', 'degraded', 'disconnected', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "source_records" DROP CONSTRAINT "source_records_org_external_version_unique";--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_org_actor_membership_fk";
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_org_source_record_fk";
--> statement-breakpoint
ALTER TABLE "leads" DROP CONSTRAINT "leads_org_source_record_fk";
--> statement-breakpoint
ALTER TABLE "leads" DROP CONSTRAINT "leads_org_owner_membership_fk";
--> statement-breakpoint
ALTER TABLE "recommendations" DROP CONSTRAINT "recommendations_org_signal_lead_source_fk";
--> statement-breakpoint
ALTER TABLE "signals" DROP CONSTRAINT "signals_org_lead_source_fk";
--> statement-breakpoint
ALTER TABLE "source_records" ADD COLUMN "integration_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integrations_org_status_index" ON "integrations" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_org_actor_membership_fk" FOREIGN KEY ("organization_id","actor_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_org_source_record_fk" FOREIGN KEY ("organization_id","source_record_id") REFERENCES "public"."source_records"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_source_record_fk" FOREIGN KEY ("organization_id","source_record_id") REFERENCES "public"."source_records"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_owner_membership_fk" FOREIGN KEY ("organization_id","owner_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_org_signal_lead_source_fk" FOREIGN KEY ("organization_id","signal_id","lead_id","source_record_id") REFERENCES "public"."signals"("organization_id","id","lead_id","source_record_id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_org_lead_source_fk" FOREIGN KEY ("organization_id","lead_id","source_record_id") REFERENCES "public"."leads"("organization_id","id","source_record_id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_org_integration_source_fk" FOREIGN KEY ("organization_id","integration_id","source_system") REFERENCES "public"."integrations"("organization_id","id","source_system") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_org_integration_external_version_unique" UNIQUE("organization_id","integration_id","source_system","source_object_type","external_record_id","source_version");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_idempotency_key_not_blank" CHECK (length(btrim("audit_events"."idempotency_key")) > 0);--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_idempotency_key_not_blank" CHECK (length(btrim("recommendations"."idempotency_key")) > 0);--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_idempotency_key_not_blank" CHECK (length(btrim("signals"."idempotency_key")) > 0);--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_source_system_not_blank" CHECK (length(btrim("source_records"."source_system")) > 0);--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_source_object_type_not_blank" CHECK (length(btrim("source_records"."source_object_type")) > 0);--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_external_record_id_not_blank" CHECK (length(btrim("source_records"."external_record_id")) > 0);--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_source_version_not_blank" CHECK (length(btrim("source_records"."source_version")) > 0);--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_idempotency_key_not_blank" CHECK (length(btrim("source_records"."idempotency_key")) > 0);--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_payload_sha256_format" CHECK ("source_records"."raw_payload_sha256" ~ '^[0-9a-f]{64}$');