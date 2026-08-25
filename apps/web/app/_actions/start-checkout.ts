"use server";

import { redirect } from "next/navigation";

import {
  cancelOrphanedSubscription,
  createStripeBillingClient,
  createStripeCustomer,
  createSubscriptionWithImmediatePayment,
  createTrialSubscription,
} from "@signaldesk/integrations/stripe-billing";
import {
  createDatabasePool,
  createOrganizationSubscription,
  getCurrentStandardPrice,
  getOrganizationSubscription,
  getPlanByKey,
  getRedeemablePromoPrice,
  recordAuditEvent,
  recordPromoRedemption,
  resurrectOrganizationSubscription,
  withAdvisoryLock,
  type DatabasePool,
  type SubscriptionStatus,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { errorReporter } from "../_lib/error-reporter";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import {
  getStripeMode,
  getStripeSecretKey,
  isBillingConfigured,
  resolveStripePriceId,
} from "../_lib/stripe-billing-config";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export interface StartCheckoutState {
  readonly error: string | null;
  /** Present once an immediate-payment subscription has been created and
   * needs the client to mount the Payment Element and confirm it. */
  readonly clientSecret: string | null;
}

const SELF_SERVE_PLAN_KEYS = new Set(["starter", "business", "scale"]);

/** A subscription in either state has fully ended — Stripe has nothing
 * left to retry or resume, so checkout should offer a brand new
 * subscription rather than refusing outright. Every other status has a
 * real, still-relevant Stripe subscription and must go through `/billing`
 * (cancel, resume, retry payment) instead of starting a second one. */
const RESUBSCRIBABLE_STATUSES = new Set<SubscriptionStatus>([
  "canceled",
  "incomplete_expired",
]);

/**
 * Records a redeemed promo without letting a failure here corrupt an
 * already-real success. Found by review: this used to be a bare
 * `recordPromoRedemption` call inside the same try/catch whose catch
 * returns "Checkout failed" — by the time it runs, the real Stripe
 * subscription and the local `organization_subscriptions` row already
 * exist, so a transient failure recording the promo (a unique-constraint
 * blip, a connection drop) told the customer checkout failed entirely,
 * discarding the paid path's real `clientSecret` needed to confirm
 * payment, even though a live/trialing subscription genuinely exists. A
 * failure here is reported so it isn't silently lost, but the real
 * outcome above it is always still returned as-is — the same "don't let
 * a non-critical follow-up write undo an already-real success" reasoning
 * `recordApprovalAuditEvent` (`apps/web/app/_lib/agent-action-approval.ts`)
 * already applies to the Agent Fabric's own approve actions.
 */
async function recordPromoRedemptionSafely(
  db: DatabasePool,
  organizationId: string,
  priceId: string,
): Promise<void> {
  try {
    await recordPromoRedemption(db, priceId);
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "start_checkout.record_promo_redemption",
      organizationId,
      correlationId: priceId,
    });
  }
}

/**
 * Starts real billing checkout. Two distinct outcomes:
 *
 * - Business's no-card trial completes entirely server-side (no payment
 *   method to collect) and redirects straight to a confirmation page.
 * - Every other path (Starter, Scale, or Business explicitly skipping its
 *   trial) creates a real `incomplete` Stripe subscription and returns a
 *   client secret for the caller to mount `@stripe/react-stripe-js`'s
 *   Payment Element against — the subscription only becomes `active` once
 *   the customer confirms payment and the webhook syncs the result.
 *
 * `organizationId` is never accepted as input — derived exclusively from
 * the authenticated session, matching every other real Server Action in
 * this app (ADR 0005).
 */
export async function startCheckoutAction(
  _prevState: StartCheckoutState,
  formData: FormData,
): Promise<StartCheckoutState> {
  const session = await getCurrentOrganization();

  if (!session) {
    redirect(
      `/login?next=${encodeURIComponent(String(formData.get("next") ?? "/pricing"))}`,
    );
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return {
      error: "Only an owner or admin can manage this workspace's subscription.",
      clientSecret: null,
    };
  }

  const email = session.email;

  if (session.isAnonymous || !email) {
    return {
      error: "Create a real account with an email before subscribing.",
      clientSecret: null,
    };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `start-checkout:${session.organizationId}`,
    10,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return {
      error: "Too many checkout attempts. Try again shortly.",
      clientSecret: null,
    };
  }

  if (!isBillingConfigured()) {
    return { error: "Billing is not configured yet.", clientSecret: null };
  }

  const planKey = String(formData.get("planKey") ?? "");
  const billingInterval = String(formData.get("billingInterval") ?? "month");
  const promoKey = formData.get("promoKey");
  const wantsTrial = formData.get("mode") === "trial";

  if (!SELF_SERVE_PLAN_KEYS.has(planKey)) {
    return {
      error: "That plan isn't available for self-serve checkout.",
      clientSecret: null,
    };
  }

  if (billingInterval !== "month" && billingInterval !== "year") {
    return { error: "Invalid billing interval.", clientSecret: null };
  }

  if (wantsTrial && planKey !== "business") {
    return { error: "Only Business offers a trial.", clientSecret: null };
  }

  // `redirect()` throws a special Next.js control-flow error that must
  // propagate uncaught — it cannot be called from inside the try block
  // below, or the catch clause would mistake it for a real failure. The
  // trial path instead sets this flag and redirects after the lock has
  // fully released.
  let trialStarted = false;

  // A real, cross-instance Postgres advisory lock (`withAdvisoryLock`,
  // `@signaldesk/persistence`) — the existing-subscription check below and
  // the real Stripe customer+subscription creation are not atomic, so two
  // concurrent requests for the same organization could both pass the
  // check and each create a live, billed Stripe subscription; only one
  // can win the local insert (`organization_subscriptions_org_unique`),
  // leaving the other's Stripe subscription orphaned with no local
  // record. Non-blocking: `lockResult` is `null` when another request
  // already holds this organization's lock, rather than queuing behind
  // it.
  const lockResult = await withAdvisoryLock(
    getPool(),
    `start-checkout:${session.organizationId}`,
    async (): Promise<StartCheckoutState> => {
      try {
        const db = getPool();

        const existing = await getOrganizationSubscription(
          db,
          session.organizationId,
        );

        if (existing && !RESUBSCRIBABLE_STATUSES.has(existing.status)) {
          return {
            error:
              "Your organization already has a subscription on file. Contact support to change it.",
            clientSecret: null,
          };
        }

        // A prior subscription fully ended — resurrect the same row into
        // a brand new Stripe subscription rather than inserting a second
        // one (organization_subscriptions_org_unique allows only one row
        // per organization; see resurrectOrganizationSubscription's doc
        // comment).
        const isResubscribing = existing !== null;

        const plan = await getPlanByKey(db, planKey);

        if (!plan || !plan.supportsSelfServeCheckout) {
          return {
            error: "That plan isn't available for self-serve checkout.",
            clientSecret: null,
          };
        }

        const price =
          typeof promoKey === "string" && promoKey
            ? await getRedeemablePromoPrice(db, promoKey)
            : await getCurrentStandardPrice(db, planKey, billingInterval);

        if (!price || price.planKey !== planKey) {
          return {
            error:
              typeof promoKey === "string" && promoKey
                ? "This promotional offer is no longer available."
                : "Pricing for that plan isn't available right now.",
            clientSecret: null,
          };
        }

        const stripePriceId = resolveStripePriceId(price);

        if (!stripePriceId) {
          return {
            error: "This plan isn't available for checkout yet.",
            clientSecret: null,
          };
        }

        const stripe = createStripeBillingClient(getStripeSecretKey());
        const customer = await createStripeCustomer(stripe, {
          email,
          organizationId: session.organizationId,
        });
        const stripeMode = getStripeMode();

        if (wantsTrial) {
          const trial = await createTrialSubscription(stripe, {
            customerId: customer.id,
            priceId: stripePriceId,
            trialDays: 14,
          });

          const trialSubscriptionInput = {
            planId: plan.id,
            planPriceId: price.id,
            status: "trialing" as const,
            stripeCustomerId: customer.id,
            stripeSubscriptionId: trial.subscriptionId,
            stripeMode,
            trialEndsAt: trial.trialEndsAt,
            currentPeriodStart: null,
            currentPeriodEnd: null,
          };
          let savedTrial;

          try {
            savedTrial = isResubscribing
              ? await resurrectOrganizationSubscription(
                  db,
                  session.organizationId,
                  trialSubscriptionInput,
                )
              : await createOrganizationSubscription(
                  db,
                  session.organizationId,
                  trialSubscriptionInput,
                );
          } catch (saveError) {
            await cancelOrphanedSubscription(
              stripe,
              trial.subscriptionId,
            ).catch((cancelError: unknown) => {
              errorReporter.captureException(cancelError, {
                operation: "start_checkout.cancel_orphaned_subscription",
                connectorSlug: "stripe",
                organizationId: session.organizationId,
                correlationId: trial.subscriptionId,
              });
            });
            throw saveError;
          }

          if (!savedTrial) {
            await cancelOrphanedSubscription(
              stripe,
              trial.subscriptionId,
            ).catch((cancelError: unknown) => {
              errorReporter.captureException(cancelError, {
                operation: "start_checkout.cancel_orphaned_subscription",
                connectorSlug: "stripe",
                organizationId: session.organizationId,
                correlationId: trial.subscriptionId,
              });
            });
            return {
              error: "Checkout failed. Please try again.",
              clientSecret: null,
            };
          }

          if (price.promoKey) {
            await recordPromoRedemptionSafely(
              db,
              session.organizationId,
              price.id,
            );
          }

          await recordAuditEvent(db, session.organizationId, {
            userId: session.userId,
            eventType: "subscription.checkout_completed",
            subjectType: "organization_subscription",
            subjectId: savedTrial.id,
            outcome: "succeeded",
            metadata: {
              planKey,
              mode: "trial",
              isResubscribing,
              stripeSubscriptionId: trial.subscriptionId,
            },
          });

          trialStarted = true;
          return { error: null, clientSecret: null };
        }

        const result = await createSubscriptionWithImmediatePayment(stripe, {
          customerId: customer.id,
          priceId: stripePriceId,
        });

        const paidSubscriptionInput = {
          planId: plan.id,
          planPriceId: price.id,
          status: "incomplete" as const,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: result.subscriptionId,
          stripeMode,
          trialEndsAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        };
        let savedSubscription;

        try {
          savedSubscription = isResubscribing
            ? await resurrectOrganizationSubscription(
                db,
                session.organizationId,
                paidSubscriptionInput,
              )
            : await createOrganizationSubscription(
                db,
                session.organizationId,
                paidSubscriptionInput,
              );
        } catch (saveError) {
          await cancelOrphanedSubscription(stripe, result.subscriptionId).catch(
            (cancelError: unknown) => {
              errorReporter.captureException(cancelError, {
                operation: "start_checkout.cancel_orphaned_subscription",
                connectorSlug: "stripe",
                organizationId: session.organizationId,
                correlationId: result.subscriptionId,
              });
            },
          );
          throw saveError;
        }

        if (!savedSubscription) {
          await cancelOrphanedSubscription(stripe, result.subscriptionId).catch(
            (cancelError: unknown) => {
              errorReporter.captureException(cancelError, {
                operation: "start_checkout.cancel_orphaned_subscription",
                connectorSlug: "stripe",
                organizationId: session.organizationId,
                correlationId: result.subscriptionId,
              });
            },
          );
          return {
            error: "Checkout failed. Please try again.",
            clientSecret: null,
          };
        }

        if (price.promoKey) {
          await recordPromoRedemptionSafely(
            db,
            session.organizationId,
            price.id,
          );
        }

        await recordAuditEvent(db, session.organizationId, {
          userId: session.userId,
          eventType: "subscription.checkout_completed",
          subjectType: "organization_subscription",
          subjectId: savedSubscription.id,
          outcome: "succeeded",
          metadata: {
            planKey,
            mode: "paid",
            isResubscribing,
            stripeSubscriptionId: result.subscriptionId,
          },
        });

        return { error: null, clientSecret: result.clientSecret };
      } catch (error) {
        return {
          error: describeActionError(error, "Checkout failed."),
          clientSecret: null,
        };
      }
    },
  );

  if (lockResult === null) {
    return {
      error:
        "A checkout is already in progress. Please wait a moment and try again.",
      clientSecret: null,
    };
  }

  if (trialStarted) {
    redirect("/billing/checkout/trial-started");
  }

  return lockResult;
}
