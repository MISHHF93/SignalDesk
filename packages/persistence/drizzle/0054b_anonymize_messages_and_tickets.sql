-- Hand-written, not drizzle-generated (touches only grants/a function body,
-- no Drizzle-tracked table shape) — named 0054b, not 0055, following this
-- repo's own established convention for out-of-band migrations that sit
-- between two drizzle-kit-generated ones (see 0032b-e's identical
-- precedent) so drizzle-kit's own idx/tag sequence continues cleanly past
-- it. Applied to the live dev project under the name
-- "0055_anonymize_messages_and_tickets" before this rename — a purely
-- cosmetic mismatch between the Supabase migration-history name and this
-- local filename, not a functional one.
--
-- Closes a real gap in anonymize_organization (migration 0032, ADR 0018):
-- that function predates messages (0050) and support_tickets (0054), so
-- neither table's real customer/PII-bearing fields were ever scrubbed on
-- organization deletion. A customer requesting "erase my data" today
-- would still have messages.counterparty_name/counterparty_email and
-- support_tickets.requester_name sitting in the database afterward.
-- Fixes that by extending the same organization_data_steward role and
-- the same anonymize_organization function, not a new mechanism.
--
-- Scope matches every existing scrubbed column exactly: only structured
-- identity fields (name/email), never free-text bodies — messages.subject/
-- snippet/body_preview and support_tickets.subject stay untouched, the
-- same disclosed limitation ADR 0018 already accepts for audit_events.metadata.
-- support_tickets.assignee_name is scrubbed to null, mirroring
-- tasks.assignee_name's own precedent exactly (an internal team member's
-- name, not customer PII, but still cleared for consistency). messages.
-- counterparty_email cannot be nulled (NOT NULL, non-blank check) so it
-- gets the same '[deleted]'-style placeholder leads.contact_name/
-- invoices.customer_name already use.

grant select, update on public.messages to organization_data_steward;
grant select, update on public.support_tickets to organization_data_steward;

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

  update public.messages
  set counterparty_name = null, counterparty_email = 'deleted@deleted.invalid'
  where organization_id = p_organization_id;

  update public.support_tickets
  set requester_name = null, assignee_name = null
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
