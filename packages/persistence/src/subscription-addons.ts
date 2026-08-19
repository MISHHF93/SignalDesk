import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface SubscriptionAddon {
  readonly id: string;
  readonly addonKey: string;
  readonly quantity: number;
  readonly stripeSubscriptionItemId: string | null;
}

interface SubscriptionAddonDbRow {
  readonly id: string;
  readonly addon_key: string;
  readonly quantity: number;
  readonly stripe_subscription_item_id: string | null;
}

export async function listSubscriptionAddons(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly SubscriptionAddon[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<SubscriptionAddonDbRow>(
      `select osa.id, pa.addon_key, osa.quantity, osa.stripe_subscription_item_id
       from public.organization_subscription_addons osa
       join public.organization_subscriptions os on os.id = osa.organization_subscription_id
       join public.plan_addons pa on pa.id = osa.plan_addon_id
       where os.organization_id = $1`,
      [organizationId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      addonKey: row.addon_key,
      quantity: row.quantity,
      stripeSubscriptionItemId: row.stripe_subscription_item_id,
    }));
  });
}

/**
 * Attaches (or updates the quantity of) an add-on on the organization's
 * subscription. Mirrors the plan itself: real Stripe subscription item
 * id is stored once the caller has actually added it to the Stripe
 * subscription — this function only records local state, it never calls
 * Stripe (see packages/integrations/src/stripe-billing for that).
 */
export async function upsertSubscriptionAddon(
  pool: DatabasePool,
  organizationId: string,
  organizationSubscriptionId: string,
  planAddonId: string,
  quantity: number,
  stripeSubscriptionItemId: string | null,
): Promise<void> {
  await withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      `insert into public.organization_subscription_addons
         (id, organization_subscription_id, plan_addon_id, quantity, stripe_subscription_item_id)
       values ($1, $2, $3, $4, $5)
       on conflict (organization_subscription_id, plan_addon_id)
       do update set quantity = excluded.quantity,
                      stripe_subscription_item_id = excluded.stripe_subscription_item_id`,
      [
        randomUUID(),
        organizationSubscriptionId,
        planAddonId,
        quantity,
        stripeSubscriptionItemId,
      ],
    );
  });
}

export async function removeSubscriptionAddon(
  pool: DatabasePool,
  organizationId: string,
  organizationSubscriptionId: string,
  planAddonId: string,
): Promise<void> {
  await withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      `delete from public.organization_subscription_addons
       where organization_subscription_id = $1 and plan_addon_id = $2`,
      [organizationSubscriptionId, planAddonId],
    );
  });
}
