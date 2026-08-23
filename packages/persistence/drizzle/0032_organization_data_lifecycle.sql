-- Real "delete my organization" and the sign-in-side enforcement it needs.
-- Per ADR 0003's own stated principle, provenance-bearing records
-- (source_records, leads/invoices/tasks, signals, recommendations,
-- audit_events) "may not update or delete" under ordinary access, and only
-- "narrow lifecycle fields may change through a future audited retention
-- path." This migration is that path, scoped to the one real request a
-- customer can make: erase my PII and stop my organization from
-- functioning. It anonymizes rather than deletes rows, so the audit trail
-- (audit_events, which restrict-references organizations — a hard delete
-- of the organizations row would fail on it regardless) stays intact for
-- its own retention window, matching the precedent every other
-- provenance table already sets. See ADR 0018 for the full design
-- reasoning (what's scrubbed, what's deliberately preserved, and why).

alter table public.organizations
  add column deactivated_at timestamptz;

-- A deactivated organization must stop resolving to a valid session —
-- otherwise a signed-in owner could return to a half-scrubbed experience
-- (real membership, anonymized display data) instead of a clean sign-out.
create or replace function public.resolve_memberships_for_identity(
  p_identity_provider text,
  p_identity_provider_subject text
)
returns table(organization_id uuid, user_id uuid, role text, status text)
security definer
set search_path = ''
stable
language sql
as $function$
  select m.organization_id, m.user_id, m.role, m.status
  from public.memberships m
  join public.users u on u.id = m.user_id
  join public.organizations o on o.id = m.organization_id
  where u.identity_provider = p_identity_provider
    and u.identity_provider_subject = p_identity_provider_subject
    and m.status = 'active'
    and o.deactivated_at is null;
$function$;

-- leads_immutable_snapshot (0003) protects every column of `leads`,
-- including contact_name/company_name — appropriate before any real
-- retention path existed, but it now blocks the one real PII-scrubbing
-- operation this migration adds, even for a BYPASSRLS SECURITY DEFINER
-- role (BEFORE UPDATE triggers fire regardless of RLS/BYPASSRLS — a
-- completely separate mechanism). Narrowing the protected column list is
-- exactly the "future audited retention path" ADR 0003 anticipated.
drop trigger if exists leads_immutable_snapshot on public.leads;

create trigger leads_immutable_snapshot
before update on public.leads
for each row execute function public.reject_immutable_column_update(
  'id',
  'organization_id',
  'source_record_id',
  'owner_membership_id',
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

-- A narrow role for exactly one operation: scrubbing PII across the
-- tables that hold it, scoped to one organization at a time. BYPASSRLS
-- because ordinary roles (and RLS itself) explicitly cannot update these
-- tables by design (ADR 0003) — the function's own hard-coded
-- `where organization_id = p_organization_id` on every statement is what
-- keeps this tenant-scoped, not RLS. Same shape as identity_provisioner
-- (0007) and integration_token_manager (0011/0016): a narrow role owning
-- SECURITY DEFINER functions, app_runtime gets EXECUTE only, never direct
-- table access to the columns being scrubbed.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'organization_data_steward') then
    create role organization_data_steward nologin nosuperuser bypassrls nocreatedb nocreaterole noreplication;
  end if;
end
$$;

grant organization_data_steward to current_user;
grant usage, create on schema public to organization_data_steward;

-- BYPASSRLS skips row-level policies, not the underlying table-level
-- GRANT system -- the function still needs ordinary GRANTs on every
-- table it touches. SELECT is required in addition to UPDATE on each
-- table: UPDATE alone covers the columns being SET, but evaluating a
-- WHERE clause (or a correlated subquery) that reads any column --
-- including the ones just being filtered on -- is a read, and needs
-- SELECT on those columns separately.
grant select, update on public.organizations to organization_data_steward;
grant select on public.memberships to organization_data_steward;
grant select, update on public.users to organization_data_steward;
grant select, update on public.leads to organization_data_steward;
grant select, update on public.invoices to organization_data_steward;
grant select, update on public.tasks to organization_data_steward;

create or replace function public.anonymize_organization(p_organization_id uuid)
returns void
security definer
set search_path = ''
language plpgsql
as $function$
begin
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization % not found', p_organization_id
      using errcode = '42501';
  end if;

  -- Users whose *only* membership is this organization — today's identity
  -- model provisions exactly one org per new user (ADR 0005, no team
  -- invites yet), so this is always true in practice, but the guard keeps
  -- this function correct the day a user can belong to more than one org:
  -- their identity must not be scrubbed just because one of their
  -- organizations was deleted.
  update public.users
  set display_name = '[deleted user]', primary_email = null
  where id in (
    select m.user_id
    from public.memberships m
    where m.organization_id = p_organization_id
  )
  and 1 = (
    select count(*) from public.memberships m2 where m2.user_id = users.id
  );

  update public.leads
  set contact_name = '[deleted]', company_name = null
  where organization_id = p_organization_id;

  update public.invoices
  set customer_name = '[deleted]'
  where organization_id = p_organization_id;

  update public.tasks
  set assignee_name = null
  where organization_id = p_organization_id;

  -- source_records, signals, recommendations, and audit_events are left
  -- untouched — real provenance/audit value, and ADR 0003 already treats
  -- them as immutable outside "a future audited retention path." A known,
  -- disclosed gap: audit_events.metadata (jsonb) may incidentally contain
  -- PII logged as part of an event (e.g. an email address in a connector
  -- payload digest) — not scrubbed by this function. See ADR 0018.
  --
  -- `slug` is deliberately not touched — organizations_immutable_identity
  -- (0003) protects it as a stable identity key, the same role
  -- identity_provider/identity_provider_subject play on `users`, not PII.
  update public.organizations
  set display_name = '[deleted organization]',
      deactivated_at = now()
  where id = p_organization_id;
end;
$function$;

alter function public.anonymize_organization(uuid) owner to organization_data_steward;
revoke execute on function public.anonymize_organization(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_organization(uuid) to app_runtime;
