-- Hand-written, not drizzle-generated (touches only a grant/a function
-- body, no Drizzle-tracked table shape) — named 0072b, not 0073, following
-- this repo's own established convention for out-of-band migrations that
-- sit between two drizzle-kit-generated ones (see 0054b's/0064b's
-- identical precedent) so drizzle-kit's own idx/tag sequence continues
-- cleanly past it.
--
-- Real gap found by review: anonymize_organization (migration 0032, ADR
-- 0018; extended by 0054b for messages/support_tickets, 0064b for
-- customer_email_replies) predates organization_invites (0046), so a
-- customer requesting "erase my data" today would still have
-- organization_invites.email — a real third-party email address, often
-- belonging to someone who never signed up and has no users row of their
-- own to be scrubbed by this function's existing sole-membership-user
-- logic — sitting in the database afterward, indefinitely, for every
-- pending/accepted/revoked/expired invite the organization ever sent.
--
-- Scope matches 0054b's/0064b's own precedent exactly: only the
-- structured identity field (email) is scrubbed, using the same
-- 'deleted@deleted.invalid' placeholder customer_email_replies.to_email/
-- messages.counterparty_email already use (email is NOT NULL with a
-- not-blank check, so it can't simply be nulled). role/status/token stay
-- untouched — token is an opaque, already-unguessable random value, not
-- PII, and revoking/expiring pending invites is a separate functional
-- question from PII erasure, out of scope for this fix specifically.

grant select, update on public.organization_invites to organization_data_steward;

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

  update public.customer_email_replies
  set to_email = 'deleted@deleted.invalid'
  where organization_id = p_organization_id;

  update public.organization_invites
  set email = 'deleted@deleted.invalid'
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
