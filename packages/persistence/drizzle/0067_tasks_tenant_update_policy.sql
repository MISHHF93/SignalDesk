-- Real gap found this pass, same shape as 0036's invoices_tenant_update
-- fix: 0030_tasks.sql granted `select, insert, update` on public.tasks to
-- app_runtime up front, but never added an UPDATE RLS policy, because at
-- the time nothing in the app updated a task. `markTaskCompletedBySourceRecord`
-- (tasks.ts, added later for the Jira closed-issue second sync pass) has
-- been issuing real `update tasks set completed = true where ...` calls
-- ever since — with RLS forced and no permissive UPDATE policy for any
-- role, every one of those statements has always silently matched zero
-- rows (Postgres doesn't error; it just finds nothing to update), so a
-- Jira issue closing has never actually marked its task complete in this
-- database, dev or production, despite the sync path itself, and this
-- exact function, being real, tested, and live-verified for everything
-- except this one silent no-op. Live-database evidence: a fresh org/task
-- reproduced the no-op deterministically (`markTaskCompletedBySourceRecord`
-- returned `false` against a real, freshly-inserted, not-yet-completed
-- task whose `source_record_id` matched exactly), and `pg_policy` on
-- `public.tasks` confirmed only `{a,r}` (insert, select) existed, no `w`
-- (update) — matching invoices' own pre-0036 state precisely.
create policy tasks_tenant_update on public.tasks
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  )
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
