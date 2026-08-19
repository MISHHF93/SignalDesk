ALTER TABLE "recommendations" DROP CONSTRAINT "recommendations_org_signal_lead_source_fk";
--> statement-breakpoint
ALTER TABLE "signals" DROP CONSTRAINT "signals_org_lead_source_fk";
--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_org_signal_lead_source_fk" FOREIGN KEY ("organization_id","signal_id","lead_id","source_record_id") REFERENCES "public"."signals"("organization_id","id","lead_id","source_record_id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_org_lead_source_fk" FOREIGN KEY ("organization_id","lead_id","source_record_id") REFERENCES "public"."leads"("organization_id","id","source_record_id") ON DELETE restrict ON UPDATE restrict;