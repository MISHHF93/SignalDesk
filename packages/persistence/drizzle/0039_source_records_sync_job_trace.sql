ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_org_id_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "source_records" ADD COLUMN "sync_job_id" uuid;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_org_sync_job_fk" FOREIGN KEY ("organization_id","sync_job_id") REFERENCES "public"."sync_jobs"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "source_records_org_sync_job_index" ON "source_records" USING btree ("organization_id","sync_job_id");