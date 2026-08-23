-- Real cross-tenant enumeration for exactly one legitimate purpose: the
-- Morning Business Agent's Vercel Cron job (PRODUCTION-ACTIVATION-
-- CHECKLIST.md Stage 12) needs to iterate every real, active organization
-- to generate one real Daily Brief artifact per org — the first case in
-- this app where a real operation legitimately needs to run across every
-- tenant, not within one.
--
-- Every existing SECURITY DEFINER function in this schema deliberately
-- relies on RLS rather than bypassing it — confirmed directly against
-- `integration_token_manager` (`nobypassrls`, per migration 0011) before
-- writing this, not assumed. This is therefore a new, narrow, deliberate
-- exception, not a broadened default. Scoped as tightly as this app's
-- existing conventions allow: a dedicated role with no `bypassrls`, a
-- single additional *permissive* select policy on `organizations` granted
-- to that role alone (never to `app_runtime` directly, so nothing about
-- the app's own normal tenant-scoped connections changes), a column-level
-- grant restricted to exactly the two columns the function needs, and a
-- function that returns only organization ids — no other column, no
-- other table.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'scheduled_job_runner') then
    create role scheduled_job_runner nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
  end if;
end
$$;

grant scheduled_job_runner to current_user;
-- `create`, not just `usage`, is required here: reassigning the function
-- below to this role via `alter function ... owner to` fails with
-- "permission denied for schema public" without it — confirmed directly
-- (not assumed) by isolating each statement in this migration against the
-- live dev database before settling on this fix, matching
-- `integration_token_manager`'s own migration (0011), which grants both.
grant usage, create on schema public to scheduled_job_runner;
grant select (id, deactivated_at) on table public.organizations to scheduled_job_runner;

drop policy if exists organizations_scheduled_job_read on public.organizations;
create policy organizations_scheduled_job_read on public.organizations
  for select
  to scheduled_job_runner
  using (true);

create or replace function public.list_active_organization_ids()
returns setof uuid
security definer
set search_path = ''
language sql
as $function$
  select id
  from public.organizations
  where deactivated_at is null;
$function$;

alter function public.list_active_organization_ids() owner to scheduled_job_runner;

grant execute on function public.list_active_organization_ids() to app_runtime;
