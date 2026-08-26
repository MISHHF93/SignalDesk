-- Hand-written, not drizzle-generated (function bodies/grants/policies
-- only, no Drizzle-tracked table shape) — named 0065b, not 0066, following
-- this repo's own established convention for out-of-band migrations that
-- sit between two drizzle-kit-generated ones (see 0032b-e/0054b/0064b's
-- identical precedent).
--
-- Real gap found by review: both the morning-brief and billing-
-- reconciliation crons cap one run at MAX_*_PER_RUN (500) organizations/
-- subscriptions, sliced off `list_active_organization_ids()`/
-- `list_stripe_linked_subscriptions()` — neither of which has an ORDER BY.
-- Once real counts exceed 500, Postgres's unordered scan can return the
-- same arbitrary subset every run, permanently excluding whatever falls
-- outside it rather than just delaying it — silently defeating the exact
-- P1 guarantee (LAUNCH-BLOCKERS.md #8) this sweep exists to provide.
--
-- billing-reconciliation: list_stripe_linked_subscriptions() now orders
-- by organization_subscriptions.updated_at ascending — the sweep's own
-- doc comment already documents that an unchanged subscription is left
-- completely untouched (no write, no updated_at bump), so a stable,
-- already-in-sync subscription naturally stays at the front of this
-- ordering (always inside the 500 cap) while one just corrected moves
-- toward the back for a while, making room for others. No new column
-- needed; only the function body changes via create or replace, which
-- preserves its existing owner/grants (already correctly scoped to
-- scheduled_job_runner/app_runtime, with public/anon/authenticated
-- already revoked by migration 0058) since the signature is unchanged.
create or replace function public.list_stripe_linked_subscriptions()
returns table (
  organization_id uuid,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  canceled_at timestamptz
)
security definer
set search_path = ''
language sql
as $function$
  select
    organization_id,
    stripe_subscription_id,
    stripe_customer_id,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    canceled_at
  from public.organization_subscriptions
  where stripe_subscription_id is not null
  order by updated_at asc;
$function$;

-- morning-brief: list_active_organization_ids() had no way to express
-- "prioritize whichever organizations haven't been briefed recently" —
-- it only ever returned the same unordered full set, every run, for the
-- caller to slice. Replaced with a new, purpose-built function that
-- performs the fair-rotation ordering AND the LIMIT server-side (cheaper
-- than fetching every active organization id and slicing in JS): each
-- organization's most recent daily_brief.generated_at (nulls first —
-- never briefed is the highest priority), tie-broken by id for
-- determinism. An organization skipped today (outside the cap) keeps its
-- older/null timestamp and floats toward the front of tomorrow's run;
-- one successfully briefed today sorts to the back, correctly
-- de-prioritized until its next real need. list_active_organization_ids()
-- itself is left in place, unchanged — it has no other real caller today,
-- but repurposing a generically-named cross-tenant primitive to bake in
-- one caller's specific selection logic would be a trap for a future
-- second one.
create or replace function public.list_organizations_needing_daily_brief(p_max integer)
returns setof uuid
security definer
set search_path = ''
language sql
as $function$
  select o.id
  from public.organizations o
  left join lateral (
    select max(a.generated_at) as last_generated_at
    from public.artifacts a
    where a.organization_id = o.id
      and a.type = 'daily_brief'
  ) latest_brief on true
  where o.deactivated_at is null
  order by latest_brief.last_generated_at asc nulls first, o.id asc
  limit p_max;
$function$;

alter function public.list_organizations_needing_daily_brief(integer) owner to scheduled_job_runner;

-- Same column-scoped grant + permissive policy shape 0055b already
-- established for organizations — scheduled_job_runner stays nobypassrls
-- (this schema's deliberate convention: every SECURITY DEFINER function
-- relies on a real, narrow policy rather than bypassing RLS), so it needs
-- its own explicit real-but-narrow access to artifacts too.
grant select (organization_id, type, generated_at) on table public.artifacts to scheduled_job_runner;

drop policy if exists artifacts_scheduled_job_read on public.artifacts;
create policy artifacts_scheduled_job_read on public.artifacts
  for select
  to scheduled_job_runner
  using (true);

-- PostgreSQL grants EXECUTE on a new function to PUBLIC by default
-- (migrations 0008/0058/0061's own recurring fix for exactly this) —
-- revoked in the same migration that creates this one, not a follow-up
-- fix after the fact.
revoke execute on function public.list_organizations_needing_daily_brief(integer) from public, anon, authenticated;
grant execute on function public.list_organizations_needing_daily_brief(integer) to app_runtime;
