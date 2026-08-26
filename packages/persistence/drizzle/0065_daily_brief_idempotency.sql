ALTER TABLE "artifacts" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_org_idempotency_unique" UNIQUE("organization_id","idempotency_key");
