import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createDatabasePool,
  getEnabledPlanAddons,
  getEntitlementUsage,
  getOrganizationSubscription,
  getPlanByKey,
  getPlanCatalog,
  listSubscriptionAddons,
  type DatabasePool,
} from "@signaldesk/persistence";

import {
  changePlanAction,
  previewPlanChangeAction,
} from "../_actions/change-plan";
import { addAddonAction, removeAddonAction } from "../_actions/manage-addon";
import { retryPaymentAction } from "../_actions/retry-subscription-payment";
import { startPaymentMethodSetupAction } from "../_actions/start-payment-method-setup";
import { getCurrentOrganization } from "../_lib/session";
import { PricingTable } from "../pricing/pricing-table";
import { CancelSubscriptionButton } from "./cancel-subscription-button";
import { ChangePlanForm } from "./change-plan-form";
import { ManageAddonForm } from "./manage-addon-form";
import { PaymentMethodForm } from "./payment-method-form";
import { ResumeSubscriptionButton } from "./resume-subscription-button";
import { RetryPaymentForm } from "./retry-payment-form";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export const metadata: Metadata = { title: "Billing" };

const STATUS_LABELS: Record<string, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Payment past due",
  canceled: "Canceled",
  incomplete: "Awaiting payment",
  incomplete_expired: "Expired — payment never completed",
  paused: "Paused",
  unpaid: "Unpaid",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { billing: bannerStatus } = await searchParams;
  const session = await getCurrentOrganization();

  if (!session) {
    redirect("/login?next=/billing");
  }

  const db = getPool();
  const subscription = await getOrganizationSubscription(
    db,
    session.organizationId,
  );
  const [plan, usage, catalog, addons, purchasedAddons] = await Promise.all([
    subscription ? getPlanByKey(db, subscription.planKey) : null,
    subscription ? getEntitlementUsage(db, session.organizationId) : null,
    getPlanCatalog(db),
    getEnabledPlanAddons(db),
    subscription
      ? listSubscriptionAddons(db, session.organizationId)
      : Promise.resolve([]),
  ]);
  const availablePlans = catalog.filter(
    (entry) =>
      entry.supportsSelfServeCheckout &&
      entry.planKey !== subscription?.planKey,
  );

  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="billing-heading">
        <div>
          <p className="sectionKicker">Billing</p>
          <h1 id="billing-heading">Your subscription.</h1>
          <p>Manage your plan and billing status.</p>
        </div>
      </section>

      {bannerStatus === "cancel_scheduled" ? (
        <p
          className="hubspotSyncStatus hubspotSyncStatus-connected"
          role="status"
        >
          Your subscription will cancel at the end of the current billing
          period. You can resume it any time before then.
        </p>
      ) : null}
      {bannerStatus === "resumed" ? (
        <p
          className="hubspotSyncStatus hubspotSyncStatus-connected"
          role="status"
        >
          Your subscription is no longer scheduled to cancel.
        </p>
      ) : null}
      {bannerStatus === "payment_method_updated" ? (
        <p
          className="hubspotSyncStatus hubspotSyncStatus-connected"
          role="status"
        >
          Payment method saved.
        </p>
      ) : null}
      {bannerStatus === "payment_method_failed" ? (
        <p className="hubspotSyncStatus hubspotSyncStatus-denied" role="alert">
          Couldn&rsquo;t save that payment method. Please try again.
        </p>
      ) : null}
      {bannerStatus === "plan_changed" ? (
        <p
          className="hubspotSyncStatus hubspotSyncStatus-connected"
          role="status"
        >
          Your plan has been changed.
        </p>
      ) : null}
      {bannerStatus === "addon_added" ? (
        <p
          className="hubspotSyncStatus hubspotSyncStatus-connected"
          role="status"
        >
          Add-on activated.
        </p>
      ) : null}
      {bannerStatus === "addon_removed" ? (
        <p
          className="hubspotSyncStatus hubspotSyncStatus-connected"
          role="status"
        >
          Add-on removed.
        </p>
      ) : null}

      {!subscription ? (
        <>
          <aside
            className="honestyNotice"
            aria-labelledby="billing-notice-heading"
          >
            <span className="noticeIcon" aria-hidden="true">
              ⚠
            </span>
            <div>
              <h2 id="billing-notice-heading">
                You don&rsquo;t have a subscription yet
              </h2>
              <p>Pick a plan below to start a subscription or trial.</p>
            </div>
          </aside>
          <PricingTable plans={catalog} />
        </>
      ) : (
        <section
          className="checkoutPanel"
          aria-labelledby="subscription-heading"
        >
          <h2 id="subscription-heading">
            {plan?.name ?? subscription.planKey}
          </h2>
          <dl className="pricingLimits">
            <div>
              <dt>Status</dt>
              <dd>
                {STATUS_LABELS[subscription.status] ?? subscription.status}
              </dd>
            </div>
            {subscription.status === "trialing" && subscription.trialEndsAt ? (
              <div>
                <dt>Trial ends</dt>
                <dd>{formatDate(subscription.trialEndsAt)}</dd>
              </div>
            ) : null}
            {subscription.currentPeriodEnd ? (
              <div>
                <dt>
                  {subscription.cancelAtPeriodEnd ? "Access ends" : "Renews"}
                </dt>
                <dd>{formatDate(subscription.currentPeriodEnd)}</dd>
              </div>
            ) : null}
          </dl>

          {usage ? (
            <dl className="pricingLimits">
              <div>
                <dt>Users</dt>
                <dd>
                  {usage.usersUsed} of {usage.usersLimit ?? "unlimited"}
                </dd>
              </div>
              <div>
                <dt>Active connections</dt>
                <dd>
                  {usage.activeConnectionsUsed} of{" "}
                  {usage.activeConnectionsLimit ?? "unlimited"}
                </dd>
              </div>
            </dl>
          ) : null}

          {subscription.cancelAtPeriodEnd ? (
            <p className="dailyBriefMeta">
              This subscription is scheduled to cancel. You&rsquo;ll keep access
              until the date above.
            </p>
          ) : null}

          {subscription.status === "canceled" ||
          subscription.status === "incomplete_expired" ? (
            <p className="dailyBriefMeta">
              This subscription has ended.{" "}
              <Link href="/pricing">See plans</Link> to start a new one.
            </p>
          ) : null}

          <div className="checkoutForm">
            {subscription.status === "canceled" ||
            subscription.status ===
              "incomplete_expired" ? null : subscription.cancelAtPeriodEnd ? (
              <ResumeSubscriptionButton />
            ) : (
              <CancelSubscriptionButton />
            )}
          </div>

          {subscription.status === "incomplete" ? (
            <>
              <p className="dailyBriefMeta">
                Your subscription was never confirmed — pick up checkout where
                you left off.
              </p>
              <RetryPaymentForm retryAction={retryPaymentAction} />
            </>
          ) : subscription.status === "canceled" ||
            subscription.status === "incomplete_expired" ? null : (
            <>
              <p className="dailyBriefMeta">
                {subscription.status === "trialing"
                  ? "Add a payment method now so your trial converts automatically instead of cancelling."
                  : subscription.status === "past_due"
                    ? "Your last payment failed — add a working card to keep your subscription active."
                    : "Update the card on file for this subscription."}
              </p>
              <PaymentMethodForm
                startSetupAction={startPaymentMethodSetupAction}
              />
            </>
          )}

          {subscription.status === "canceled" ||
          subscription.status === "incomplete" ||
          subscription.status === "incomplete_expired" ||
          availablePlans.length === 0 ? null : (
            <>
              <p className="dailyBriefMeta">Change your plan.</p>
              <ChangePlanForm
                availablePlans={availablePlans}
                previewAction={previewPlanChangeAction}
                changeAction={changePlanAction}
              />
            </>
          )}

          {subscription.status === "canceled" ||
          subscription.status === "incomplete" ||
          subscription.status === "incomplete_expired" ? null : (
            <>
              <p className="dailyBriefMeta">Add extra capacity.</p>
              <ManageAddonForm
                addons={addons}
                purchased={purchasedAddons}
                addAction={addAddonAction}
                removeAction={removeAddonAction}
              />
            </>
          )}
        </section>
      )}
    </main>
  );
}
