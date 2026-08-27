-- ISSUES-REMAINING.md P1 #1: a dropped QuickBooks webhook delivery
-- (Intuit never retries once this app acks 200, a deliberate design so
-- one bad realm can't fail a whole multi-company batch) had no
-- reconciliation path -- bounded by incremental sync naturally catching
-- up on the next successful webhook or a manual "Sync Now", but no
-- automatic catch-up existed. That entry named the real blocker as "a
-- background worker/queue this app doesn't have yet" -- no longer true:
-- Vercel Cron now runs two real scheduled jobs (morning-brief,
-- billing-reconciliation), so this is newly buildable the same way.
--
-- Same real cross-tenant enumeration pattern as 0055b/0065b/0056: a
-- dedicated, narrow, non-bypassrls role (scheduled_job_runner, already
-- exists), column-scoped grants restricted to exactly what the function
-- needs, a single additional permissive select policy on each table
-- scoped to that role alone (never to app_runtime directly), and a
-- function returning only the columns the cron needs. Ordered the same
-- fair-rotation way 0065b's daily-brief function is (least-recently-
-- synced first, nulls first) rather than left unordered -- this repo has
-- already found the "unbounded scan + a fixed cap" bug twice (0056,
-- 0065b) and there's no reason to reintroduce it a third time here.
grant select (organization_id, id, source_system, external_account_id, status)
  on table public.integrations to scheduled_job_runner;
grant select (integration_id, source_system, started_at)
  on table public.sync_jobs to scheduled_job_runner;

drop policy if exists integrations_scheduled_job_read on public.integrations;
create policy integrations_scheduled_job_read on public.integrations
  for select
  to scheduled_job_runner
  using (true);

drop policy if exists sync_jobs_scheduled_job_read on public.sync_jobs;
create policy sync_jobs_scheduled_job_read on public.sync_jobs
  for select
  to scheduled_job_runner
  using (true);

create or replace function public.list_quickbooks_integrations_needing_reconciliation(p_max integer)
returns table (
  organization_id uuid,
  integration_id uuid,
  realm_id text
)
security definer
set search_path = ''
language sql
as $function$
  select i.organization_id, i.id, i.external_account_id
  from public.integrations i
  join public.organizations o on o.id = i.organization_id
  left join lateral (
    select max(sj.started_at) as last_started_at
    from public.sync_jobs sj
    where sj.integration_id = i.id
      and sj.source_system = 'quickbooks'
  ) latest_sync on true
  where i.source_system = 'quickbooks'
    and i.status = 'active'
    and o.deactivated_at is null
  order by latest_sync.last_started_at asc nulls first, i.id asc
  limit p_max;
$function$;

alter function public.list_quickbooks_integrations_needing_reconciliation(integer)
  owner to scheduled_job_runner;

-- PostgreSQL grants EXECUTE on a new function to PUBLIC by default
-- (migrations 0008/0058/0061's own recurring fix) -- revoked in the same
-- migration that creates this one, per 0065b's own lesson learned.
revoke execute on function public.list_quickbooks_integrations_needing_reconciliation(integer)
  from public, anon, authenticated;
grant execute on function public.list_quickbooks_integrations_needing_reconciliation(integer)
  to app_runtime;

-- A new sync_jobs.trigger value for this cron's own runs, additive to
-- the existing ('initial', 'manual', 'webhook') set (0035, extended by
-- 0036 for 'webhook').
alter table public.sync_jobs drop constraint sync_jobs_trigger_allowed;
alter table public.sync_jobs add constraint sync_jobs_trigger_allowed
  check (trigger in ('initial', 'manual', 'webhook', 'scheduled_reconciliation'));
