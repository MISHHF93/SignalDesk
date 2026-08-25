"use server";

import { redirect } from "next/navigation";

import {
  addSubscriptionAddonItem,
  createStripeBillingClient,
  removeSubscriptionAddonItem,
} from "@signaldesk/integrations/stripe-billing";
import {
  createDatabasePool,
  getEnabledPlanAddons,
  getOrganizationSubscription,
  listSubscriptionAddons,
  recordAuditEvent,
  removeSubscriptionAddon,
  upsertSubscriptionAddon,
  withAdvisoryLock,
  type DatabasePool,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  getStripeSecretKey,
  resolveStripePriceId,
} from "../_lib/stripe-billing-config";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export interface AddonActionState {
  readonly error: string | null;
}

/**
 * Purchases one unit of a capacity add-on (+5 active connections or +10
 * users) — the configuration-driven SKUs `getEnabledPlanAddons` already
 * lists, real and tested since the billing build, but with no purchase
 * path anywhere in the product until now. Adds a real Stripe subscription
 * item with proration, then records it locally.
 */
export async function addAddonAction(
  addonKey: string,
): Promise<AddonActionState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to do this." };
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return {
      error: "Only an owner or admin can manage this workspace's subscription.",
    };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `manage-addon:${session.organizationId}`,
    10,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return { error: "Too many attempts. Try again shortly." };
  }

  const db = getPool();

  // A real, cross-instance Postgres advisory lock (`withAdvisoryLock`,
  // same primitive `start-checkout.ts` uses for its own double-submit
  // guard). Without it, two concurrent requests (a double-click, a
  // client retry) can both pass the "already active" check below before
  // either writes, each creating a real, billed Stripe subscription
  // item — `upsertSubscriptionAddon`'s `ON CONFLICT ... DO UPDATE` then
  // silently overwrites the first `stripeSubscriptionItemId` with the
  // second, permanently orphaning the first: still billed on Stripe,
  // never referenced locally again, so `removeAddonAction` can never
  // remove it. Non-blocking, matching `withAdvisoryLock`'s own
  // documented fast-reject behavior for a Server Action.
  const lockResult = await withAdvisoryLock(
    db,
    `manage-addon-lock:${session.organizationId}`,
    async (): Promise<AddonActionState> => {
      const [subscription, addons, purchased] = await Promise.all([
        getOrganizationSubscription(db, session.organizationId),
        getEnabledPlanAddons(db),
        listSubscriptionAddons(db, session.organizationId),
      ]);

      if (!subscription || !subscription.stripeSubscriptionId) {
        return { error: "There's no subscription to add this to." };
      }

      const addon = addons.find((entry) => entry.addonKey === addonKey);

      if (!addon) {
        return { error: "That add-on isn't currently available." };
      }

      if (purchased.some((entry) => entry.addonKey === addonKey)) {
        return { error: "That add-on is already active." };
      }

      const stripePriceId = resolveStripePriceId(addon);

      if (!stripePriceId) {
        return { error: "That add-on isn't available for checkout yet." };
      }

      try {
        const stripe = createStripeBillingClient(getStripeSecretKey());
        const result = await addSubscriptionAddonItem(stripe, {
          subscriptionId: subscription.stripeSubscriptionId,
          addonPriceId: stripePriceId,
          quantity: 1,
        });

        await upsertSubscriptionAddon(
          db,
          session.organizationId,
          subscription.id,
          addon.id,
          1,
          result.subscriptionItemId,
        );

        await recordAuditEvent(db, session.organizationId, {
          userId: session.userId,
          eventType: "subscription.addon_added",
          subjectType: "organization_subscription",
          subjectId: subscription.id,
          outcome: "succeeded",
          metadata: {
            addonKey,
            stripeSubscriptionItemId: result.subscriptionItemId,
          },
        });
      } catch (error) {
        return {
          error: describeActionError(error, "Failed to add that add-on."),
        };
      }

      return { error: null };
    },
  );

  if (lockResult === null) {
    return {
      error:
        "Another add-on change is already in progress. Please wait a moment and try again.",
    };
  }

  if (lockResult.error !== null) {
    return lockResult;
  }

  redirect("/billing?billing=addon_added");
}

/**
 * Removes a previously-purchased add-on entirely (this app has no
 * quantity picker — an add-on is either on or off, matching "keep them
 * configuration-driven and easy to disable"). Removes the real Stripe
 * subscription item with proration, then the local record.
 */
export async function removeAddonAction(
  addonKey: string,
): Promise<AddonActionState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to do this." };
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return {
      error: "Only an owner or admin can manage this workspace's subscription.",
    };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `manage-addon:${session.organizationId}`,
    10,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return { error: "Too many attempts. Try again shortly." };
  }

  const db = getPool();

  // Same lock as `addAddonAction`, same key — a per-organization
  // mutual-exclusion boundary around every add-on mutation, not just
  // same-action races. Without it, a concurrent add and remove (or two
  // removes) could both read the same `purchasedAddon` before either
  // writes, calling Stripe twice for one item.
  const lockResult = await withAdvisoryLock(
    db,
    `manage-addon-lock:${session.organizationId}`,
    async (): Promise<AddonActionState> => {
      const [subscription, addons, purchased] = await Promise.all([
        getOrganizationSubscription(db, session.organizationId),
        getEnabledPlanAddons(db),
        listSubscriptionAddons(db, session.organizationId),
      ]);

      if (!subscription) {
        return { error: "There's no subscription to remove this from." };
      }

      const addon = addons.find((entry) => entry.addonKey === addonKey);
      const purchasedAddon = purchased.find(
        (entry) => entry.addonKey === addonKey,
      );

      if (
        !addon ||
        !purchasedAddon ||
        !purchasedAddon.stripeSubscriptionItemId
      ) {
        return { error: "That add-on isn't currently active." };
      }

      try {
        const stripe = createStripeBillingClient(getStripeSecretKey());
        await removeSubscriptionAddonItem(
          stripe,
          purchasedAddon.stripeSubscriptionItemId,
        );

        await removeSubscriptionAddon(
          db,
          session.organizationId,
          subscription.id,
          addon.id,
        );

        await recordAuditEvent(db, session.organizationId, {
          userId: session.userId,
          eventType: "subscription.addon_removed",
          subjectType: "organization_subscription",
          subjectId: subscription.id,
          outcome: "succeeded",
          metadata: { addonKey },
        });
      } catch (error) {
        return {
          error: describeActionError(error, "Failed to remove that add-on."),
        };
      }

      return { error: null };
    },
  );

  if (lockResult === null) {
    return {
      error:
        "Another add-on change is already in progress. Please wait a moment and try again.",
    };
  }

  if (lockResult.error !== null) {
    return lockResult;
  }

  redirect("/billing?billing=addon_removed");
}
