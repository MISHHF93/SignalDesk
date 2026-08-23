-- QuickBooks connector completion (docs/adr/0022-quickbooks-payments-incremental-sync-webhooks.md):
-- a real payments table (mirrors invoices' shape/RLS exactly), a
-- 'webhook' sync_jobs trigger for the new signature-verified webhook
-- endpoint, an invoices UPDATE policy (invoices previously had a
-- select+insert-only grant/policy pair — no re-sync path existed to
-- observe a status transition until now), and a SECURITY DEFINER
-- resolver so the unauthenticated webhook handler can look up which
-- organization/integration owns a QuickBooks realmId before it has any
-- tenant context to set (same bootstrapping problem
-- resolve_organization_for_stripe_subscription solves for the Stripe
-- webhook, 0025).

CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"linked_invoice_external_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"canonical_schema_version" integer NOT NULL,
	"normalization_version" text NOT NULL,
	"normalized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "payments_org_source_record_unique" UNIQUE("organization_id","source_record_id"),
	CONSTRAINT "payments_customer_name_not_blank" CHECK (length(btrim("payments"."customer_name")) > 0),
	CONSTRAINT "payments_amount_nonnegative" CHECK ("payments"."amount_cents" >= 0),
	CONSTRAINT "payments_currency_format" CHECK ("payments"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "payments_canonical_schema_version_positive" CHECK ("payments"."canonical_schema_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "sync_jobs" DROP CONSTRAINT "sync_jobs_trigger_allowed";--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD COLUMN "entity_type" text;--> statement-breakpoint
UPDATE "sync_jobs" SET "entity_type" = CASE "source_system"
  WHEN 'hubspot' THEN 'lead'
  WHEN 'quickbooks' THEN 'invoice'
  WHEN 'asana' THEN 'task'
  ELSE 'invoice'
END WHERE "entity_type" IS NULL;--> statement-breakpoint
ALTER TABLE "sync_jobs" ALTER COLUMN "entity_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_entity_type_allowed" CHECK ("sync_jobs"."entity_type" in ('lead', 'invoice', 'payment', 'task'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_source_record_fk" FOREIGN KEY ("organization_id","source_record_id") REFERENCES "public"."source_records"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "payments_org_received_index" ON "payments" USING btree ("organization_id","received_at");--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_trigger_allowed" CHECK ("sync_jobs"."trigger" in ('initial', 'manual', 'webhook'));
--> statement-breakpoint

alter table public.payments enable row level security;
--> statement-breakpoint
alter table public.payments force row level security;
--> statement-breakpoint

create policy payments_tenant_select on public.payments
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy payments_tenant_insert on public.payments
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.payments from public, anon, authenticated;
--> statement-breakpoint

grant select, insert on public.payments to app_runtime;
--> statement-breakpoint

-- invoices previously had select+insert-only RLS (0029) since there was
-- no real re-sync path to observe a status transition. That path exists
-- now (the incremental sync's "closed since cursor" pass) — add the
-- missing UPDATE policy. The grant already includes update (0029 granted
-- select, insert, update together even though no UPDATE policy existed
-- yet), so this is the only piece that was missing.
create policy invoices_tenant_update on public.invoices
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create or replace function public.resolve_organization_and_integration_for_quickbooks_realm(p_realm_id text)
returns table(organization_id uuid, integration_id uuid)
language sql
stable
security definer
set search_path = ''
as $function$
  select organization_id, id
  from public.integrations
  where source_system = 'quickbooks'
    and external_account_id = p_realm_id
    and status = 'active';
$function$;
--> statement-breakpoint

alter function public.resolve_organization_and_integration_for_quickbooks_realm(text) owner to identity_provisioner;
--> statement-breakpoint
revoke execute on function public.resolve_organization_and_integration_for_quickbooks_realm(text) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.resolve_organization_and_integration_for_quickbooks_realm(text) to app_runtime;