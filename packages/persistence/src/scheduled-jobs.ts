import type { DatabasePool } from "./client";
import type { SubscriptionStatus } from "./subscriptions";

/**
 * The one real cross-tenant read in this codebase — every other query
 * goes through `withTenantContext`, scoped to a single organization.
 * Backed by `public.list_active_organization_ids()` (migration 0055b), a
 * narrow SECURITY DEFINER function returning only organization ids for
 * non-deactivated organizations — deliberately not `pool.query("select id
 * from organizations")` directly, which RLS would reduce to zero rows
 * (or whatever single tenant happens to be set) for `app_runtime`'s own
 * connection. Called via plain `pool.query`, matching `rate-limit.ts`'s
 * own precedent for a query that is real but not tenant-scoped.
 */
export async function listActiveOrganizationIds(
  pool: DatabasePool,
): Promise<readonly string[]> {
  // `list_active_organization_ids()` returns `setof uuid` — an explicit
  // `as t(id)` column alias is required to select it as a named `id`
  // column; without it Postgres raises "column 'id' does not exist"
  // (caught by this function's own live-database test before this ever
  // reached a real cron invocation).
  const result = await pool.query<{ id: string }>(
    "select id from public.list_active_organization_ids() as t(id)",
  );

  return result.rows.map((row) => row.id);
}

/**
 * The morning-brief cron's real organization selection, up to `max` ids —
 * real gap found by review: capping an unordered full scan at
 * `MAX_ORGANIZATIONS_PER_RUN` could silently, permanently exclude
 * whatever organization count exceeds that cap, rather than just delaying
 * it. `list_organizations_needing_daily_brief` (migration 0065b) orders by
 * each organization's own last `daily_brief` artifact (never-briefed
 * first), so an organization skipped today floats toward the front of
 * tomorrow's run instead of never being reached — the ordering, not this
 * wrapper, is what actually fixes the bug.
 */
export async function listOrganizationsNeedingDailyBrief(
  pool: DatabasePool,
  max: number,
): Promise<readonly string[]> {
  const result = await pool.query<{ id: string }>(
    "select id from public.list_organizations_needing_daily_brief($1) as t(id)",
    [max],
  );

  return result.rows.map((row) => row.id);
}

export interface QuickBooksIntegrationNeedingReconciliation {
  readonly organizationId: string;
  readonly integrationId: string;
  readonly realmId: string;
}

/**
 * The QuickBooks webhook reconciliation cron's real organization/
 * integration selection (migration 0069, ISSUES-REMAINING.md P1 #1).
 * Intuit never retries a webhook this app has already acked 200 for, so
 * a realm whose inline sync failed mid-webhook has no automatic catch-up
 * today beyond the next successful webhook or a manual "Sync Now" — this
 * is that catch-up: a periodic, unconditional re-sync of every active
 * QuickBooks connection, reusing the exact same
 * `syncQuickBooksInvoices`/`syncQuickBooksPayments` functions the webhook
 * and "Sync Now" already call, so a webhook that silently dropped simply
 * gets caught by the next scheduled pass. Same fair-rotation ordering
 * `list_organizations_needing_daily_brief` (0065b) already established —
 * least-recently-synced first, nulls first (never synced ⇒ highest
 * priority) — so a real connection count exceeding `max` is delayed, not
 * permanently excluded, the same bug class 0056/0065b already found and
 * fixed twice elsewhere in this schema.
 */
export async function listQuickBooksIntegrationsNeedingReconciliation(
  pool: DatabasePool,
  max: number,
): Promise<readonly QuickBooksIntegrationNeedingReconciliation[]> {
  const result = await pool.query<{
    organization_id: string;
    integration_id: string;
    realm_id: string;
  }>(
    "select organization_id, integration_id, realm_id from public.list_quickbooks_integrations_needing_reconciliation($1)",
    [max],
  );

  return result.rows.map((row) => ({
    organizationId: row.organization_id,
    integrationId: row.integration_id,
    realmId: row.realm_id,
  }));
}

export interface StripeLinkedSubscription {
  readonly organizationId: string;
  readonly stripeSubscriptionId: string;
  readonly stripeCustomerId: string | null;
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  readonly currentPeriodStart: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt: Date | null;
}

interface StripeLinkedSubscriptionRow {
  readonly organization_id: string;
  readonly stripe_subscription_id: string;
  readonly stripe_customer_id: string | null;
  readonly status: SubscriptionStatus;
  readonly trial_ends_at: Date | null;
  readonly current_period_start: Date | null;
  readonly current_period_end: Date | null;
  readonly cancel_at_period_end: boolean;
  readonly canceled_at: Date | null;
}

/**
 * The billing reconciliation sweep's real cross-tenant read
 * (LAUNCH-BLOCKERS.md P1 #8, migration 0056) — every organization with a
 * Stripe subscription ever attached, so the sweep can ask Stripe's own
 * API for each one's current, authoritative state and correct local
 * drift left by a missed or out-of-order webhook. Same
 * `scheduled_job_runner` SECURITY DEFINER pattern
 * `listActiveOrganizationIds` (migration 0055b) already established;
 * returns only the columns the sweep needs to compare and correct — never
 * plan/pricing columns, since the sweep only ever mirrors Stripe-owned
 * status/date fields (see the migration's own doc comment for why).
 */
export async function listStripeLinkedSubscriptions(
  pool: DatabasePool,
): Promise<readonly StripeLinkedSubscription[]> {
  const result = await pool.query<StripeLinkedSubscriptionRow>(
    `select organization_id, stripe_subscription_id, stripe_customer_id, status,
            trial_ends_at, current_period_start, current_period_end,
            cancel_at_period_end, canceled_at
     from public.list_stripe_linked_subscriptions()`,
  );

  return result.rows.map((row) => ({
    organizationId: row.organization_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeCustomerId: row.stripe_customer_id,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    canceledAt: row.canceled_at,
  }));
}
