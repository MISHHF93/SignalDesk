CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_membership_id" uuid,
	"actor_kind" text NOT NULL,
	"event_type" text NOT NULL,
	"event_schema_version" integer NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"source_record_id" uuid,
	"correlation_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"outcome" text NOT NULL,
	"payload_digest" text NOT NULL,
	"previous_event_digest" text,
	"event_digest" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"retention_class" text NOT NULL,
	"retain_until" timestamp with time zone NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "audit_events_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "audit_events_org_event_digest_unique" UNIQUE("organization_id","event_digest"),
	CONSTRAINT "audit_events_actor_kind_allowed" CHECK ("audit_events"."actor_kind" in ('user', 'system', 'integration')),
	CONSTRAINT "audit_events_actor_membership_consistent" CHECK (("audit_events"."actor_kind" = 'user' and "audit_events"."actor_membership_id" is not null) or ("audit_events"."actor_kind" <> 'user' and "audit_events"."actor_membership_id" is null)),
	CONSTRAINT "audit_events_schema_version_positive" CHECK ("audit_events"."event_schema_version" > 0),
	CONSTRAINT "audit_events_outcome_allowed" CHECK ("audit_events"."outcome" in ('allowed', 'denied', 'succeeded', 'failed', 'recorded')),
	CONSTRAINT "audit_events_retention_after_recording" CHECK ("audit_events"."retain_until" > "audit_events"."recorded_at")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"owner_membership_id" uuid,
	"contact_name" text NOT NULL,
	"company_name" text,
	"stage" text NOT NULL,
	"value_cents" bigint,
	"currency" text,
	"expected_response_hours" integer NOT NULL,
	"source_created_at" timestamp with time zone NOT NULL,
	"last_interaction_at" timestamp with time zone,
	"canonical_schema_version" integer NOT NULL,
	"normalization_version" text NOT NULL,
	"normalized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "leads_org_source_record_unique" UNIQUE("organization_id","source_record_id"),
	CONSTRAINT "leads_org_id_source_record_unique" UNIQUE("organization_id","id","source_record_id"),
	CONSTRAINT "leads_contact_name_not_blank" CHECK (length(btrim("leads"."contact_name")) > 0),
	CONSTRAINT "leads_expected_response_hours_positive" CHECK ("leads"."expected_response_hours" > 0),
	CONSTRAINT "leads_canonical_schema_version_positive" CHECK ("leads"."canonical_schema_version" > 0),
	CONSTRAINT "leads_value_currency_pair" CHECK (("leads"."value_cents" is null and "leads"."currency" is null) or ("leads"."value_cents" is not null and "leads"."currency" is not null))
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "memberships_org_user_unique" UNIQUE("organization_id","user_id"),
	CONSTRAINT "memberships_role_allowed" CHECK ("memberships"."role" in ('owner', 'admin', 'member', 'viewer')),
	CONSTRAINT "memberships_status_allowed" CHECK ("memberships"."status" in ('invited', 'active', 'suspended', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_slug_not_blank" CHECK (length(btrim("organizations"."slug")) > 0),
	CONSTRAINT "organizations_display_name_not_blank" CHECK (length(btrim("organizations"."display_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"recommended_next_step" text NOT NULL,
	"rationale" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"recommendation_schema_version" integer NOT NULL,
	"generator_kind" text NOT NULL,
	"generator_version" text NOT NULL,
	"confidence_basis_points" integer,
	"source_observed_at" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendations_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "recommendations_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "recommendations_status_allowed" CHECK ("recommendations"."status" in ('active', 'accepted', 'dismissed', 'expired', 'superseded')),
	CONSTRAINT "recommendations_generator_kind_allowed" CHECK ("recommendations"."generator_kind" in ('deterministic_rule', 'model_assisted')),
	CONSTRAINT "recommendations_schema_version_positive" CHECK ("recommendations"."recommendation_schema_version" > 0),
	CONSTRAINT "recommendations_confidence_range" CHECK ("recommendations"."confidence_basis_points" is null or ("recommendations"."confidence_basis_points" >= 0 and "recommendations"."confidence_basis_points" <= 10000))
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"headline" text NOT NULL,
	"rationale" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"signal_schema_version" integer NOT NULL,
	"rule_version" text NOT NULL,
	"evidence_digest" text NOT NULL,
	"source_observed_at" timestamp with time zone NOT NULL,
	"evaluated_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signals_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "signals_org_id_lead_source_unique" UNIQUE("organization_id","id","lead_id","source_record_id"),
	CONSTRAINT "signals_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "signals_status_allowed" CHECK ("signals"."status" in ('open', 'acknowledged', 'resolved', 'dismissed')),
	CONSTRAINT "signals_schema_version_positive" CHECK ("signals"."signal_schema_version" > 0),
	CONSTRAINT "signals_resolution_state_consistent" CHECK (("signals"."status" in ('resolved', 'dismissed') and "signals"."resolved_at" is not null) or ("signals"."status" in ('open', 'acknowledged') and "signals"."resolved_at" is null))
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_system" text NOT NULL,
	"source_object_type" text NOT NULL,
	"external_record_id" text NOT NULL,
	"source_version" text NOT NULL,
	"source_schema_version" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"observed_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_payload_sha256" text NOT NULL,
	"raw_payload_byte_length" bigint NOT NULL,
	"raw_payload_content_type" text,
	"raw_payload_storage_key" text,
	"raw_payload_retain_until" timestamp with time zone,
	"raw_payload_deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_records_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "source_records_org_external_version_unique" UNIQUE("organization_id","source_system","source_object_type","external_record_id","source_version"),
	CONSTRAINT "source_records_org_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "source_records_schema_version_positive" CHECK ("source_records"."source_schema_version" > 0),
	CONSTRAINT "source_records_payload_length_nonnegative" CHECK ("source_records"."raw_payload_byte_length" >= 0),
	CONSTRAINT "source_records_payload_storage_has_retention" CHECK ("source_records"."raw_payload_storage_key" is null or "source_records"."raw_payload_retain_until" is not null),
	CONSTRAINT "source_records_deleted_payload_not_stored" CHECK ("source_records"."raw_payload_deleted_at" is null or "source_records"."raw_payload_storage_key" is null)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_provider" text NOT NULL,
	"identity_provider_subject" text NOT NULL,
	"display_name" text NOT NULL,
	"primary_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_identity_provider_subject_unique" UNIQUE("identity_provider","identity_provider_subject"),
	CONSTRAINT "users_identity_provider_not_blank" CHECK (length(btrim("users"."identity_provider")) > 0),
	CONSTRAINT "users_identity_subject_not_blank" CHECK (length(btrim("users"."identity_provider_subject")) > 0),
	CONSTRAINT "users_display_name_not_blank" CHECK (length(btrim("users"."display_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_org_actor_membership_fk" FOREIGN KEY ("organization_id","actor_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_org_source_record_fk" FOREIGN KEY ("organization_id","source_record_id") REFERENCES "public"."source_records"("organization_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_source_record_fk" FOREIGN KEY ("organization_id","source_record_id") REFERENCES "public"."source_records"("organization_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_owner_membership_fk" FOREIGN KEY ("organization_id","owner_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_org_signal_lead_source_fk" FOREIGN KEY ("organization_id","signal_id","lead_id","source_record_id") REFERENCES "public"."signals"("organization_id","id","lead_id","source_record_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_org_lead_source_fk" FOREIGN KEY ("organization_id","lead_id","source_record_id") REFERENCES "public"."leads"("organization_id","id","source_record_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_org_recorded_at_index" ON "audit_events" USING btree ("organization_id","recorded_at");--> statement-breakpoint
CREATE INDEX "audit_events_org_correlation_index" ON "audit_events" USING btree ("organization_id","correlation_id");--> statement-breakpoint
CREATE INDEX "leads_org_stage_index" ON "leads" USING btree ("organization_id","stage");--> statement-breakpoint
CREATE INDEX "memberships_user_id_index" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommendations_org_status_index" ON "recommendations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "signals_org_status_evaluated_index" ON "signals" USING btree ("organization_id","status","evaluated_at");--> statement-breakpoint
CREATE INDEX "source_records_org_observed_at_index" ON "source_records" USING btree ("organization_id","observed_at");