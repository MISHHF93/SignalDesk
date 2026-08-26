-- Real regression found by review, this session: 0065b_scheduled_job_fair_
-- rotation.sql added `order by updated_at asc` to
-- list_stripe_linked_subscriptions() (SECURITY DEFINER, owned by
-- scheduled_job_runner) to fix the sweep's fair-rotation cap, but never
-- extended scheduled_job_runner's column-scoped grant (0056) to cover
-- updated_at — the one new column that ORDER BY clause reads. The result:
-- every call to this function (including the real billing-reconciliation
-- cron route) has failed with "permission denied for table
-- organization_subscriptions" since 0065b was applied — a worse outcome
-- than the unfair-rotation bug that migration was fixing. Column-scoped,
-- matching 0056's own narrow precedent, not a table-wide grant.

grant select (updated_at) on table public.organization_subscriptions to scheduled_job_runner;
