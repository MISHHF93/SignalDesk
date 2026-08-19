-- Replace broad tenant policies with least-capability policies and make
-- provenance-bearing columns immutable. Application roles must not own these
-- tables, be superusers, or have BYPASSRLS. Tenant context must come from a
-- trusted server transaction, never from connector or request payload data.

alter table public.integrations enable row level security;
--> statement-breakpoint
alter table public.integrations force row level security;
--> statement-breakpoint

drop policy if exists organizations_tenant_isolation on public.organizations;
--> statement-breakpoint
create policy organizations_tenant_select on public.organizations
  for select
  using (
    id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy organizations_tenant_insert on public.organizations
  for insert
  with check (
    id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy organizations_tenant_update on public.organizations
  for update
  using (
    id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

drop policy if exists memberships_tenant_isolation on public.memberships;
--> statement-breakpoint
create policy memberships_tenant_select on public.memberships
  for select
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy memberships_tenant_insert on public.memberships
  for insert
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy memberships_tenant_update on public.memberships
  for update
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

drop policy if exists integrations_tenant_select on public.integrations;
--> statement-breakpoint
drop policy if exists integrations_tenant_insert on public.integrations;
--> statement-breakpoint
drop policy if exists integrations_tenant_update on public.integrations;
--> statement-breakpoint
create policy integrations_tenant_select on public.integrations
  for select
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy integrations_tenant_insert on public.integrations
  for insert
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy integrations_tenant_update on public.integrations
  for update
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

-- Source and canonical snapshots are append-only for ordinary roles. A future
-- audited retention procedure may update only raw-payload lifecycle columns.
drop policy if exists source_records_tenant_isolation on public.source_records;
--> statement-breakpoint
create policy source_records_tenant_select on public.source_records
  for select
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy source_records_tenant_insert on public.source_records
  for insert
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

drop policy if exists leads_tenant_isolation on public.leads;
--> statement-breakpoint
create policy leads_tenant_select on public.leads
  for select
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy leads_tenant_insert on public.leads
  for insert
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

drop policy if exists signals_tenant_isolation on public.signals;
--> statement-breakpoint
create policy signals_tenant_select on public.signals
  for select
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy signals_tenant_insert on public.signals
  for insert
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy signals_tenant_update on public.signals
  for update
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

drop policy if exists recommendations_tenant_isolation on public.recommendations;
--> statement-breakpoint
create policy recommendations_tenant_select on public.recommendations
  for select
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy recommendations_tenant_insert on public.recommendations
  for insert
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint
create policy recommendations_tenant_update on public.recommendations
  for update
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

create or replace function public.reject_immutable_column_update()
returns trigger
language plpgsql
as $function$
declare
  immutable_column text;
begin
  foreach immutable_column in array tg_argv
  loop
    if to_jsonb(new) -> immutable_column is distinct from to_jsonb(old) -> immutable_column then
      raise exception 'immutable column %.% cannot be changed', tg_table_name, immutable_column
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$function$;
--> statement-breakpoint

create trigger organizations_immutable_identity
before update on public.organizations
for each row execute function public.reject_immutable_column_update(
  'id', 'slug', 'created_at'
);
--> statement-breakpoint
create trigger users_immutable_identity
before update on public.users
for each row execute function public.reject_immutable_column_update(
  'id', 'identity_provider', 'identity_provider_subject', 'created_at'
);
--> statement-breakpoint
create trigger memberships_immutable_identity
before update on public.memberships
for each row execute function public.reject_immutable_column_update(
  'id', 'organization_id', 'user_id', 'created_at'
);
--> statement-breakpoint
create trigger integrations_immutable_identity
before update on public.integrations
for each row execute function public.reject_immutable_column_update(
  'id', 'organization_id', 'source_system', 'external_account_id', 'created_at'
);
--> statement-breakpoint
create trigger source_records_immutable_provenance
before update on public.source_records
for each row execute function public.reject_immutable_column_update(
  'id',
  'organization_id',
  'integration_id',
  'source_system',
  'source_object_type',
  'external_record_id',
  'source_version',
  'source_schema_version',
  'idempotency_key',
  'source_updated_at',
  'observed_at',
  'ingested_at',
  'raw_payload_sha256',
  'raw_payload_byte_length',
  'raw_payload_content_type',
  'created_at'
);
--> statement-breakpoint
create trigger leads_immutable_snapshot
before update on public.leads
for each row execute function public.reject_immutable_column_update(
  'id',
  'organization_id',
  'source_record_id',
  'owner_membership_id',
  'contact_name',
  'company_name',
  'stage',
  'value_cents',
  'currency',
  'expected_response_hours',
  'source_created_at',
  'last_interaction_at',
  'canonical_schema_version',
  'normalization_version',
  'normalized_at',
  'created_at',
  'updated_at'
);
--> statement-breakpoint
create trigger signals_immutable_provenance
before update on public.signals
for each row execute function public.reject_immutable_column_update(
  'id',
  'organization_id',
  'lead_id',
  'source_record_id',
  'kind',
  'headline',
  'rationale',
  'idempotency_key',
  'signal_schema_version',
  'rule_version',
  'evidence_digest',
  'source_observed_at',
  'evaluated_at',
  'created_at'
);
--> statement-breakpoint
create trigger recommendations_immutable_provenance
before update on public.recommendations
for each row execute function public.reject_immutable_column_update(
  'id',
  'organization_id',
  'signal_id',
  'lead_id',
  'source_record_id',
  'recommended_next_step',
  'rationale',
  'idempotency_key',
  'recommendation_schema_version',
  'generator_kind',
  'generator_version',
  'confidence_basis_points',
  'source_observed_at',
  'valid_until',
  'created_at'
);
--> statement-breakpoint
create trigger audit_events_immutable_record
before update on public.audit_events
for each row execute function public.reject_immutable_column_update(
  'id',
  'organization_id',
  'actor_membership_id',
  'actor_kind',
  'event_type',
  'event_schema_version',
  'subject_type',
  'subject_id',
  'source_record_id',
  'correlation_id',
  'idempotency_key',
  'outcome',
  'payload_digest',
  'previous_event_digest',
  'event_digest',
  'metadata',
  'retention_class',
  'retain_until',
  'occurred_at',
  'recorded_at'
);
