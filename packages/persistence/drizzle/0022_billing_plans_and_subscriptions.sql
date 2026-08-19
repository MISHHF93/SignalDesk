-- Real subscription billing schema. Four table groups:
--
-- 1. Catalog (plans, plan_prices, plan_entitlements, plan_addons) — global,
--    not tenant-scoped, no RLS: this is public pricing-page data, the same
--    trust tier as the connector catalog (packages/integrations), except
--    versioned in real rows instead of TypeScript constants, per explicit
--    requirement: grandfathered prices, promotional prices, and future
--    price versions must all be possible without ever changing a
--    customer's plan_key. app_runtime gets SELECT only — new prices,
--    entitlement versions, or promotions are added by a future migration,
--    the same "reviewed change" tier as adding a plan itself, not routine
--    application writes.
--
-- 2. Subscription state (organization_subscriptions,
--    organization_subscription_addons) — real tenant data, standard
--    forced-RLS tenant isolation matching every other tenant table.
--
-- 3. Internal cost instrumentation (internal_cost_events) — NEVER exposed
--    to customers or used for customer-facing metering (explicit
--    requirement: no direct metering by tokens/webhooks/events/records/
--    cards/AI calls/dashboard views). Tenant-scoped so a real per-org cost
--    picture is possible, but its only purpose is internal unit-economics
--    analysis.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null,
  name text not null,
  tier_order smallint not null,
  is_recommended boolean not null default false,
  is_custom_pricing boolean not null default false,
  supports_self_serve_checkout boolean not null default true,
  differentiation_summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_plan_key_unique unique (plan_key),
  constraint plans_tier_order_unique unique (tier_order),
  constraint plans_plan_key_not_blank check (length(btrim(plan_key)) > 0),
  constraint plans_name_not_blank check (length(btrim(name)) > 0)
);
--> statement-breakpoint

create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete restrict,
  billing_interval text not null,
  amount_cents integer,
  currency text not null default 'usd',
  stripe_price_id_test text,
  stripe_price_id_live text,
  price_kind text not null default 'standard',
  promo_key text,
  promo_max_redemptions integer,
  promo_redemptions_count integer not null default 0,
  promo_starts_at timestamptz,
  promo_ends_at timestamptz,
  is_active_for_new_checkouts boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  constraint plan_prices_billing_interval_allowed check (billing_interval in ('month', 'year')),
  constraint plan_prices_price_kind_allowed check (price_kind in ('standard', 'promotional')),
  constraint plan_prices_amount_nonnegative check (amount_cents is null or amount_cents >= 0),
  constraint plan_prices_promo_redemptions_nonnegative check (promo_redemptions_count >= 0),
  constraint plan_prices_promo_key_requires_promotional check (
    (price_kind = 'promotional' and promo_key is not null)
    or (price_kind = 'standard' and promo_key is null)
  ),
  constraint plan_prices_promo_key_not_blank check (promo_key is null or length(btrim(promo_key)) > 0),
  -- A plain unique constraint, not a partial index: Postgres unique
  -- constraints already treat NULL as never equal to another NULL, so
  -- this enforces "unique among non-null promo keys, unlimited standard
  -- (null promo_key) rows" without needing a WHERE clause — which matters
  -- because a partial index has no representation in Drizzle's schema.ts,
  -- and would show as permanent false drift in `drizzle-kit check`.
  constraint plan_prices_promo_key_unique unique (promo_key)
);
--> statement-breakpoint

create index plan_prices_plan_id_index on public.plan_prices (plan_id);
--> statement-breakpoint

create table public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete restrict,
  included_users integer,
  included_active_connections integer,
  capability_flags jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  constraint plan_entitlements_users_nonnegative check (included_users is null or included_users >= 0),
  constraint plan_entitlements_connections_nonnegative check (included_active_connections is null or included_active_connections >= 0)
);
--> statement-breakpoint

create index plan_entitlements_plan_id_index on public.plan_entitlements (plan_id);
--> statement-breakpoint

create table public.plan_addons (
  id uuid primary key default gen_random_uuid(),
  addon_key text not null,
  name text not null,
  grants_users integer not null default 0,
  grants_active_connections integer not null default 0,
  amount_cents integer not null,
  billing_interval text not null default 'month',
  stripe_price_id_test text,
  stripe_price_id_live text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_addons_addon_key_unique unique (addon_key),
  constraint plan_addons_addon_key_not_blank check (length(btrim(addon_key)) > 0),
  constraint plan_addons_billing_interval_allowed check (billing_interval in ('month', 'year')),
  constraint plan_addons_amount_nonnegative check (amount_cents >= 0),
  constraint plan_addons_grants_something check (grants_users > 0 or grants_active_connections > 0)
);
--> statement-breakpoint

create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  plan_price_id uuid references public.plan_prices(id) on delete restrict,
  status text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_mode text not null,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_org_unique unique (organization_id),
  constraint organization_subscriptions_status_allowed check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'paused')
  ),
  constraint organization_subscriptions_stripe_mode_allowed check (stripe_mode in ('test', 'live'))
);
--> statement-breakpoint

-- Plain (non-partial) indexes for the same reason as
-- plan_prices_promo_key_unique above — a bare `index().on(...)` in
-- schema.ts has no way to express a WHERE clause.
create index organization_subscriptions_stripe_subscription_id_index
  on public.organization_subscriptions (stripe_subscription_id);
--> statement-breakpoint
create index organization_subscriptions_stripe_customer_id_index
  on public.organization_subscriptions (stripe_customer_id);
--> statement-breakpoint

create table public.organization_subscription_addons (
  id uuid primary key default gen_random_uuid(),
  organization_subscription_id uuid not null references public.organization_subscriptions(id) on delete cascade,
  plan_addon_id uuid not null references public.plan_addons(id) on delete restrict,
  quantity integer not null default 1,
  stripe_subscription_item_id text,
  created_at timestamptz not null default now(),
  constraint organization_subscription_addons_unique unique (organization_subscription_id, plan_addon_id),
  constraint organization_subscription_addons_quantity_positive check (quantity > 0)
);
--> statement-breakpoint

create table public.internal_cost_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  quantity numeric not null default 1,
  estimated_cost_cents integer,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint internal_cost_events_event_type_not_blank check (length(btrim(event_type)) > 0),
  constraint internal_cost_events_quantity_positive check (quantity > 0)
);
--> statement-breakpoint

create index internal_cost_events_org_occurred_index
  on public.internal_cost_events (organization_id, occurred_at desc);
--> statement-breakpoint

-- RLS: only the tenant-scoped tables. The catalog tables (plans,
-- plan_prices, plan_entitlements, plan_addons) intentionally have none —
-- see this migration's header comment.

alter table public.organization_subscriptions enable row level security;
--> statement-breakpoint
alter table public.organization_subscriptions force row level security;
--> statement-breakpoint
create policy organization_subscriptions_tenant_isolation on public.organization_subscriptions
  for all
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

alter table public.organization_subscription_addons enable row level security;
--> statement-breakpoint
alter table public.organization_subscription_addons force row level security;
--> statement-breakpoint
create policy organization_subscription_addons_tenant_isolation on public.organization_subscription_addons
  for all
  using (
    exists (
      select 1 from public.organization_subscriptions
      where organization_subscriptions.id = organization_subscription_addons.organization_subscription_id
        and organization_subscriptions.organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    )
  )
  with check (
    exists (
      select 1 from public.organization_subscriptions
      where organization_subscriptions.id = organization_subscription_addons.organization_subscription_id
        and organization_subscriptions.organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    )
  );
--> statement-breakpoint

alter table public.internal_cost_events enable row level security;
--> statement-breakpoint
alter table public.internal_cost_events force row level security;
--> statement-breakpoint
create policy internal_cost_events_tenant_isolation on public.internal_cost_events
  for all
  using (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );
--> statement-breakpoint

-- Supabase's PostgREST default-grants anon/authenticated on new public
-- tables (see sql/provision_app_role.sql's header) — strip those
-- explicitly for every table this migration creates, same as the
-- original tenant tables.
revoke all on public.plans, public.plan_prices, public.plan_entitlements, public.plan_addons,
  public.organization_subscriptions, public.organization_subscription_addons, public.internal_cost_events
  from public, anon, authenticated;
--> statement-breakpoint

-- Catalog tables: read-only for the app. New prices/entitlement versions/
-- promotions are added by a future migration, not by application code.
grant select on public.plans, public.plan_prices, public.plan_entitlements, public.plan_addons
  to app_runtime;
--> statement-breakpoint

-- Real tenant billing state: the app creates and updates these at
-- checkout and via webhooks. No delete grant, matching this codebase's
-- existing append-mostly convention.
grant select, insert, update on public.organization_subscriptions, public.organization_subscription_addons
  to app_runtime;
--> statement-breakpoint

-- Internal-only instrumentation: insert to record, select for internal
-- tooling. Never exposed through any customer-facing query.
grant select, insert on public.internal_cost_events to app_runtime;
