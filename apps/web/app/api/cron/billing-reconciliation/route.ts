import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  createStripeBillingClient,
  mapStripeSubscriptionToSyncFields,
  retrieveRawSubscription,
} from "@signaldesk/integrations/stripe-billing";
import {
  createDatabasePool,
  listStripeLinkedSubscriptions,
  updateSubscriptionFromStripe,
  type DatabasePool,
  type StripeLinkedSubscription,
  type SubscriptionStatus,
  type UpdateSubscriptionFromStripeInput,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { logger } from "../../../_lib/logger";
import {
  getStripeSecretKey,
  isBillingConfigured,
} from "../../../_lib/stripe-billing-config";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

// Same real, disclosed safety bound `morning-brief`'s cron already
// established for this exact reason (bounding one invocation within
// Vercel's function duration limit) — see that route's own comment. Real
// gap found by review: `listStripeLinkedSubscriptions` used to have no
// ordering, so once real subscription count exceeded this cap, the same
// arbitrary subset could be returned every run, permanently excluding
// the rest rather than just delaying them — silently defeating the exact
// guarantee this sweep exists to provide (LAUNCH-BLOCKERS.md P1 #8). It
// now orders by `updated_at` ascending (migration 0065b): an untouched,
// already-in-sync subscription stays at the front (always inside the
// cap), while one just corrected moves toward the back for a while,
// making room for others.
const MAX_SUBSCRIPTIONS_PER_RUN = 500;

function datesDiffer(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) {
    return a !== b;
  }
  return a.getTime() !== b.getTime();
}

/**
 * Compares Stripe's authoritative fields against what's stored locally —
 * only the fields `updateSubscriptionFromStripe` mirrors from Stripe, not
 * plan/pricing (this sweep never touches those). Named fields only, so
 * the response and logs can say exactly what drifted, not just that
 * something did.
 */
export function findDrift(
  local: StripeLinkedSubscription,
  desired: UpdateSubscriptionFromStripeInput,
): readonly string[] {
  const drifted: string[] = [];

  if (local.status !== desired.status) {
    drifted.push("status");
  }
  if (datesDiffer(local.trialEndsAt, desired.trialEndsAt ?? null)) {
    drifted.push("trialEndsAt");
  }
  if (
    datesDiffer(local.currentPeriodStart, desired.currentPeriodStart ?? null)
  ) {
    drifted.push("currentPeriodStart");
  }
  if (datesDiffer(local.currentPeriodEnd, desired.currentPeriodEnd ?? null)) {
    drifted.push("currentPeriodEnd");
  }
  // `?? false` (Stripe's own real default for a subscription with no
  // scheduled cancellation), not `?? local.cancelAtPeriodEnd` — the
  // latter compares local against itself whenever `desired` omits this
  // field, silently disabling drift detection instead of just leaving it
  // unset. Inert today (`mapStripeSubscriptionToSyncFields`, this route's
  // one real source for `desired`, always sets a real boolean here), but
  // `UpdateSubscriptionFromStripeInput.cancelAtPeriodEnd` is genuinely
  // optional on the shared type, so this only stays correct by accident
  // for any other caller `findDrift` might gain.
  if (local.cancelAtPeriodEnd !== (desired.cancelAtPeriodEnd ?? false)) {
    drifted.push("cancelAtPeriodEnd");
  }
  if (datesDiffer(local.canceledAt, desired.canceledAt ?? null)) {
    drifted.push("canceledAt");
  }

  return drifted;
}

/**
 * LAUNCH-BLOCKERS.md P1 #8: the billing state reconciliation sweep. The
 * real-time webhook (`billing/webhooks/stripe/route.ts`) is the primary
 * sync path, but Stripe's own delivery guarantee is best-effort — a
 * missed or out-of-order webhook silently leaves a local
 * `organization_subscriptions` row stale (e.g. still `active` after
 * Stripe actually canceled it, wrongly continuing to grant entitlements).
 * This sweep asks Stripe directly, for every organization that has ever
 * had a Stripe subscription attached, and corrects any drift — reading
 * Stripe's raw payload through the exact same
 * `mapStripeSubscriptionToSyncFields` mapping the webhook uses, so both
 * paths agree on what a given Stripe subscription means.
 *
 * Secured the same way `morning-brief` already is: Vercel's own
 * documented `CRON_SECRET` bearer-token convention. One organization's
 * failure (a Stripe API error, e.g.) is caught and reported individually,
 * never aborting the whole run. An organization with no drift is left
 * completely untouched — no write, no `updated_at` bump — so this sweep
 * is silent by default and only ever visible in the log/response when it
 * actually corrects something.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBillingConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Billing is not configured" },
      { status: 503 },
    );
  }

  const db = getPool();
  const stripe = createStripeBillingClient(getStripeSecretKey());
  const linkedSubscriptions = (await listStripeLinkedSubscriptions(db)).slice(
    0,
    MAX_SUBSCRIPTIONS_PER_RUN,
  );

  let reconciled = 0;
  let unchanged = 0;
  let failed = 0;
  const corrections: Array<{
    organizationId: string;
    stripeSubscriptionId: string;
    driftedFields: readonly string[];
  }> = [];

  for (const local of linkedSubscriptions) {
    try {
      const subscription = await retrieveRawSubscription(
        stripe,
        local.stripeSubscriptionId,
      );
      const fields = mapStripeSubscriptionToSyncFields(subscription);
      const desired: UpdateSubscriptionFromStripeInput = {
        ...fields,
        status: fields.status as SubscriptionStatus,
      };
      const driftedFields = findDrift(local, desired);

      if (driftedFields.length === 0) {
        unchanged += 1;
        continue;
      }

      await updateSubscriptionFromStripe(
        db,
        local.organizationId,
        local.stripeSubscriptionId,
        desired,
      );

      reconciled += 1;
      corrections.push({
        organizationId: local.organizationId,
        stripeSubscriptionId: local.stripeSubscriptionId,
        driftedFields,
      });
      logger.log("warn", "Corrected subscription drift", {
        operation: "cron.billing_reconciliation",
        organizationId: local.organizationId,
        correlationId: local.stripeSubscriptionId,
      });
    } catch (error) {
      failed += 1;
      errorReporter.captureException(error, {
        organizationId: local.organizationId,
        operation: "cron.billing_reconciliation",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    subscriptionsConsidered: linkedSubscriptions.length,
    reconciled,
    unchanged,
    failed,
    corrections,
  });
}
