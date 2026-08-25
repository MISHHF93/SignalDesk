import { randomUUID } from "node:crypto";

import { evaluatePolicy } from "@signaldesk/domain";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "unpaid";

export interface OrganizationSubscription {
  readonly id: string;
  readonly organizationId: string;
  readonly planId: string;
  readonly planKey: string;
  readonly planPriceId: string | null;
  readonly status: SubscriptionStatus;
  readonly stripeCustomerId: string | null;
  readonly stripeSubscriptionId: string | null;
  readonly stripeMode: "test" | "live";
  readonly trialEndsAt: Date | null;
  readonly currentPeriodStart: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt: Date | null;
}

interface SubscriptionDbRow {
  readonly id: string;
  readonly organization_id: string;
  readonly plan_id: string;
  readonly plan_key: string;
  readonly plan_price_id: string | null;
  readonly status: SubscriptionStatus;
  readonly stripe_customer_id: string | null;
  readonly stripe_subscription_id: string | null;
  readonly stripe_mode: "test" | "live";
  readonly trial_ends_at: Date | null;
  readonly current_period_start: Date | null;
  readonly current_period_end: Date | null;
  readonly cancel_at_period_end: boolean;
  readonly canceled_at: Date | null;
}

function toSubscription(row: SubscriptionDbRow): OrganizationSubscription {
  return {
    id: row.id,
    organizationId: row.organization_id,
    planId: row.plan_id,
    planKey: row.plan_key,
    planPriceId: row.plan_price_id,
    status: row.status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeMode: row.stripe_mode,
    trialEndsAt: row.trial_ends_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    canceledAt: row.canceled_at,
  };
}

const SUBSCRIPTION_SELECT = `
  select os.id, os.organization_id, os.plan_id, p.plan_key, os.plan_price_id,
         os.status, os.stripe_customer_id, os.stripe_subscription_id, os.stripe_mode,
         os.trial_ends_at, os.current_period_start, os.current_period_end,
         os.cancel_at_period_end, os.canceled_at
  from public.organization_subscriptions os
  join public.plans p on p.id = os.plan_id
`;

export async function getOrganizationSubscription(
  pool: DatabasePool,
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<SubscriptionDbRow>(
      `${SUBSCRIPTION_SELECT} where os.organization_id = $1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toSubscription(row) : null;
  });
}

export interface CreateSubscriptionInput {
  readonly planId: string;
  readonly planPriceId: string | null;
  readonly status: SubscriptionStatus;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
  readonly stripeMode: "test" | "live";
  readonly trialEndsAt: Date | null;
  readonly currentPeriodStart: Date | null;
  readonly currentPeriodEnd: Date | null;
}

/**
 * Creates the organization's subscription row. There is at most one per
 * organization (organization_subscriptions_org_unique) — a plan change
 * updates this same row (see `updateSubscriptionFromStripe`) rather than
 * creating a new one, matching how Stripe itself treats a plan change as
 * an update to the existing Subscription object, not a new one.
 */
export async function createOrganizationSubscription(
  pool: DatabasePool,
  organizationId: string,
  input: CreateSubscriptionInput,
): Promise<OrganizationSubscription> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<SubscriptionDbRow>(
      `insert into public.organization_subscriptions
         (id, organization_id, plan_id, plan_price_id, status, stripe_customer_id,
          stripe_subscription_id, stripe_mode, trial_ends_at, current_period_start, current_period_end)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id, organization_id, plan_id, plan_price_id, status, stripe_customer_id,
                 stripe_subscription_id, stripe_mode, trial_ends_at, current_period_start,
                 current_period_end, cancel_at_period_end, canceled_at`,
      [
        randomUUID(),
        organizationId,
        input.planId,
        input.planPriceId,
        input.status,
        input.stripeCustomerId,
        input.stripeSubscriptionId,
        input.stripeMode,
        input.trialEndsAt,
        input.currentPeriodStart,
        input.currentPeriodEnd,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("organization_subscriptions insert returned no row");
    }

    // The insert's RETURNING doesn't have plan_key (no join available on
    // an insert) — re-read through the joined view for a consistent shape.
    const withPlanKey = await client.query<SubscriptionDbRow>(
      `${SUBSCRIPTION_SELECT} where os.id = $1`,
      [row.id],
    );

    const joined = withPlanKey.rows[0];

    if (!joined) {
      throw new Error(
        "organization_subscriptions row disappeared after insert",
      );
    }

    return toSubscription(joined);
  });
}

/**
 * Re-activates a canceled/expired organization into a brand new Stripe
 * subscription. `organization_subscriptions_org_unique` means this always
 * UPDATEs the existing row rather than inserting a second one — the same
 * "one row per org, plan changes update it in place" invariant
 * `createOrganizationSubscription` documents, extended to cover
 * resubscribing after a subscription has fully ended. Every field is
 * replaced, including resetting `cancel_at_period_end`/`canceled_at`,
 * because this is a genuinely new subscription, not a continuation of the
 * old one. Scoped to rows currently `canceled`/`incomplete_expired` as a
 * database-level guard against resurrecting a row that's actually still
 * live (e.g. a race with a second concurrent checkout attempt) — returns
 * `null` if that guard didn't match, which the caller must treat as "stop
 * and surface an error," not retry silently, since a new Stripe
 * subscription has already been created by this point and would otherwise
 * be left unlinked locally.
 */
export async function resurrectOrganizationSubscription(
  pool: DatabasePool,
  organizationId: string,
  input: CreateSubscriptionInput,
): Promise<OrganizationSubscription | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<SubscriptionDbRow>(
      `update public.organization_subscriptions
       set plan_id = $2,
           plan_price_id = $3,
           status = $4,
           stripe_customer_id = $5,
           stripe_subscription_id = $6,
           stripe_mode = $7,
           trial_ends_at = $8,
           current_period_start = $9,
           current_period_end = $10,
           cancel_at_period_end = false,
           canceled_at = null,
           updated_at = now()
       where organization_id = $1
         and status in ('canceled', 'incomplete_expired')
       returning id, organization_id, plan_id, plan_price_id, status, stripe_customer_id,
                 stripe_subscription_id, stripe_mode, trial_ends_at, current_period_start,
                 current_period_end, cancel_at_period_end, canceled_at`,
      [
        organizationId,
        input.planId,
        input.planPriceId,
        input.status,
        input.stripeCustomerId,
        input.stripeSubscriptionId,
        input.stripeMode,
        input.trialEndsAt,
        input.currentPeriodStart,
        input.currentPeriodEnd,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    const withPlanKey = await client.query<SubscriptionDbRow>(
      `${SUBSCRIPTION_SELECT} where os.id = $1`,
      [row.id],
    );

    const joined = withPlanKey.rows[0];
    return joined ? toSubscription(joined) : null;
  });
}

export interface UpdateSubscriptionFromStripeInput {
  readonly planId?: string;
  readonly planPriceId?: string | null;
  readonly status: SubscriptionStatus;
  readonly trialEndsAt?: Date | null;
  readonly currentPeriodStart?: Date | null;
  readonly currentPeriodEnd?: Date | null;
  readonly cancelAtPeriodEnd?: boolean;
  readonly canceledAt?: Date | null;
  /** The real Stripe event's own `created` timestamp (webhook callers
   * only — direct, synchronous callers like cancel/resume/change-plan
   * Server Actions and the reconciliation cron have no such value and
   * should omit this entirely). When present, this write is only applied
   * if it's at least as new as whatever event last actually wrote this
   * row (`stripe_event_synced_at`) — Stripe does not guarantee webhook
   * delivery order, so without this guard a delayed retry of a stale
   * event (e.g. an old `invoice.payment_failed` arriving after a newer
   * `customer.subscription.updated` already recorded `active`) could
   * silently regress real state back to something Stripe itself has
   * already superseded. Omitted entirely, this behaves exactly as before
   * — an unconditional write, correct for a caller that just read fresh
   * ground truth directly (a synchronous API response, or the
   * reconciliation sweep's own `retrieveRawSubscription` call), not an
   * out-of-band, possibly-delayed event. */
  readonly stripeEventCreatedAt?: Date;
}

/**
 * The webhook-driven sync point: Stripe is the source of truth for
 * subscription state, this just mirrors it. Looked up by
 * `stripe_subscription_id` (webhooks identify the subscription, not the
 * organization) — the caller (the webhook handler) is responsible for
 * resolving which organization owns it before calling this, since a plain
 * `withTenantContext` lookup by Stripe id would need tenant context we
 * don't have yet at that point; this function assumes the tenant context
 * the caller already established.
 *
 * Returns `null` both when no row matches and when a real row exists but
 * `stripeEventCreatedAt`'s ordering guard rejected this specific write as
 * stale — the caller can't currently tell those two apart, matching this
 * function's existing "no distinct not-found signal" contract; neither
 * caller today needs to distinguish them (the webhook handler treats
 * either case as "nothing more to do here").
 */
export async function updateSubscriptionFromStripe(
  pool: DatabasePool,
  organizationId: string,
  stripeSubscriptionId: string,
  input: UpdateSubscriptionFromStripeInput,
): Promise<OrganizationSubscription | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<SubscriptionDbRow>(
      `update public.organization_subscriptions
       set plan_id = coalesce($3, plan_id),
           plan_price_id = case when $4::boolean then $5::uuid else plan_price_id end,
           status = $6,
           trial_ends_at = case when $7::boolean then $8::timestamptz else trial_ends_at end,
           current_period_start = case when $9::boolean then $10::timestamptz else current_period_start end,
           current_period_end = case when $11::boolean then $12::timestamptz else current_period_end end,
           cancel_at_period_end = coalesce($13, cancel_at_period_end),
           canceled_at = case when $14::boolean then $15::timestamptz else canceled_at end,
           stripe_event_synced_at = case when $16::boolean then $17::timestamptz else stripe_event_synced_at end,
           updated_at = now()
       where organization_id = $1 and stripe_subscription_id = $2
         and (
           $16::boolean = false
           or stripe_event_synced_at is null
           or stripe_event_synced_at <= $17::timestamptz
         )
       returning id, organization_id, plan_id, plan_price_id, status, stripe_customer_id,
                 stripe_subscription_id, stripe_mode, trial_ends_at, current_period_start,
                 current_period_end, cancel_at_period_end, canceled_at`,
      [
        organizationId,
        stripeSubscriptionId,
        input.planId ?? null,
        "planPriceId" in input,
        input.planPriceId ?? null,
        input.status,
        "trialEndsAt" in input,
        input.trialEndsAt ?? null,
        "currentPeriodStart" in input,
        input.currentPeriodStart ?? null,
        "currentPeriodEnd" in input,
        input.currentPeriodEnd ?? null,
        input.cancelAtPeriodEnd ?? null,
        "canceledAt" in input,
        input.canceledAt ?? null,
        input.stripeEventCreatedAt !== undefined,
        input.stripeEventCreatedAt ?? null,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    const withPlanKey = await client.query<SubscriptionDbRow>(
      `${SUBSCRIPTION_SELECT} where os.id = $1`,
      [row.id],
    );

    const joined = withPlanKey.rows[0];
    return joined ? toSubscription(joined) : null;
  });
}

/**
 * Looks up which organization owns a Stripe subscription/customer id —
 * needed by the webhook handler, which only ever learns a Stripe id, not
 * an organization id, from the event payload. `organization_subscriptions`
 * has FORCE ROW LEVEL SECURITY, so a plain query with no tenant context
 * set returns zero rows for every id, not "all rows" — resolving the
 * tenant is the whole point of this call, so it goes through the same
 * SECURITY DEFINER bootstrapping pattern `resolve_memberships_for_identity`
 * (0007) already established for sign-in, not a raw table read (0025).
 * Every subsequent read/write goes back through `withTenantContext` using
 * the organization id this resolves.
 */
export async function findOrganizationIdByStripeSubscriptionId(
  pool: DatabasePool,
  stripeSubscriptionId: string,
): Promise<string | null> {
  const result = await pool.query<{
    resolve_organization_for_stripe_subscription: string | null;
  }>(`select public.resolve_organization_for_stripe_subscription($1)`, [
    stripeSubscriptionId,
  ]);

  return result.rows[0]?.resolve_organization_for_stripe_subscription ?? null;
}

export async function findOrganizationIdByStripeCustomerId(
  pool: DatabasePool,
  stripeCustomerId: string,
): Promise<string | null> {
  const result = await pool.query<{
    resolve_organization_for_stripe_customer: string | null;
  }>(`select public.resolve_organization_for_stripe_customer($1)`, [
    stripeCustomerId,
  ]);

  return result.rows[0]?.resolve_organization_for_stripe_customer ?? null;
}

export interface EntitlementUsage {
  readonly usersUsed: number;
  readonly usersLimit: number | null;
  readonly activeConnectionsUsed: number;
  readonly activeConnectionsLimit: number | null;
  readonly capabilityFlags: Record<string, boolean>;
}

/**
 * Real usage vs. real entitlements — `usersUsed`/`activeConnectionsUsed`
 * are live counts against `memberships`/`integrations` (the same tables
 * every other part of this app already treats as the source of truth),
 * never a cached or estimated number. `activeConnectionsUsed` counts
 * `degraded` connections alongside `active` ones (ADR 0043) — a
 * degraded connection still occupies a real, live connection slot; it
 * hasn't been disconnected. Limits fold in any purchased add-ons
 * (organization_subscription_addons) on top of the plan's base
 * entitlement. A null limit means negotiated/unbounded (Enterprise, or no
 * subscription row at all yet).
 */
export async function getEntitlementUsage(
  pool: DatabasePool,
  organizationId: string,
): Promise<EntitlementUsage> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{
      users_used: string;
      active_connections_used: string;
      included_users: number | null;
      included_active_connections: number | null;
      capability_flags: Record<string, boolean> | null;
      addon_users: string | null;
      addon_connections: string | null;
    }>(
      `select
         (select count(*) from public.memberships
            where organization_id = $1 and status = 'active') as users_used,
         (select count(*) from public.integrations
            where organization_id = $1 and status in ('active', 'degraded')) as active_connections_used,
         ent.included_users,
         ent.included_active_connections,
         ent.capability_flags,
         (select coalesce(sum(osa.quantity * pa.grants_users), 0)
            from public.organization_subscription_addons osa
            join public.plan_addons pa on pa.id = osa.plan_addon_id
            join public.organization_subscriptions os2 on os2.id = osa.organization_subscription_id
            where os2.organization_id = $1) as addon_users,
         (select coalesce(sum(osa.quantity * pa.grants_active_connections), 0)
            from public.organization_subscription_addons osa
            join public.plan_addons pa on pa.id = osa.plan_addon_id
            join public.organization_subscriptions os2 on os2.id = osa.organization_subscription_id
            where os2.organization_id = $1) as addon_connections
       from public.organization_subscriptions os
       join public.plan_entitlements ent
         on ent.plan_id = os.plan_id and ent.effective_to is null
       where os.organization_id = $1
         and os.status in ('trialing', 'active', 'past_due')`,
      [organizationId],
    );

    const row = result.rows[0];

    const usersUsed = row ? Number(row.users_used) : 0;
    const activeConnectionsUsed = row ? Number(row.active_connections_used) : 0;

    if (!row) {
      // No subscription row exists yet, or the existing one no longer
      // grants access (canceled/incomplete/incomplete_expired/unpaid/
      // paused) — nothing is entitled. Without the status filter above,
      // a churned customer's subscription row would still join to
      // plan_entitlements and keep granting full access forever; `active`
      // and `trialing` obviously still count, and `past_due` counts too
      // (a grace period while Stripe retries the charge, not an instant
      // cutoff for one failed payment) — every other status means the
      // customer currently has no paid access, so this falls through to
      // the same honest zero this branch already used for "no
      // subscription row at all."
      return {
        usersUsed,
        usersLimit: 0,
        activeConnectionsUsed,
        activeConnectionsLimit: 0,
        capabilityFlags: {},
      };
    }

    const usersLimit =
      row.included_users === null
        ? null
        : row.included_users + Number(row.addon_users ?? 0);
    const activeConnectionsLimit =
      row.included_active_connections === null
        ? null
        : row.included_active_connections + Number(row.addon_connections ?? 0);

    return {
      usersUsed,
      usersLimit,
      activeConnectionsUsed,
      activeConnectionsLimit,
      capabilityFlags: row.capability_flags ?? {},
    };
  });
}

/**
 * The one real, wired enforcement point today: whether connecting one
 * more integration would exceed the plan's active-connection allowance.
 * Called before creating a new integration row in every OAuth callback
 * route. A null limit (negotiated/Enterprise) never blocks.
 */
/**
 * Routed through the shared `evaluatePolicy` (`@signaldesk/domain`, ADR
 * 0028) rather than checking the limit inline — the same evaluator
 * `AgentGatewayService` (apps/web) uses for its own, unrelated capability
 * check. External behavior is unchanged: still a plain boolean, so no
 * caller needs to change.
 */
export async function canAddActiveConnection(
  pool: DatabasePool,
  organizationId: string,
): Promise<boolean> {
  const usage = await getEntitlementUsage(pool, organizationId);
  return (
    evaluatePolicy({
      kind: "connector_connection_limit",
      activeConnectionsUsed: usage.activeConnectionsUsed,
      activeConnectionsLimit: usage.activeConnectionsLimit,
    }).outcome === "allow"
  );
}
