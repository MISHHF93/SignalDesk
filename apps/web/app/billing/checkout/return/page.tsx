import type { Metadata } from "next";
import Link from "next/link";

import {
  createDatabasePool,
  getOrganizationSubscription,
  type DatabasePool,
} from "@business-dashboard/persistence";

import { getCurrentOrganization } from "../../../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export const metadata: Metadata = { title: "Payment status" };

/**
 * Stripe's Payment Element redirects here after `confirmPayment()` with
 * `redirect_status` in the query string (`succeeded`, `processing`, or
 * `requires_payment_method` on outright failure). The subscription's real
 * status still comes from `organization_subscriptions` — the webhook, not
 * this page, is the source of truth (see `billing/webhooks/stripe`); this
 * page reads whatever has synced so far rather than asserting success
 * itself, since the webhook may not have landed yet.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_status?: string }>;
}) {
  const { redirect_status: redirectStatus } = await searchParams;
  const session = await getCurrentOrganization();
  const subscription = session
    ? await getOrganizationSubscription(getPool(), session.organizationId)
    : null;

  const failed = redirectStatus === "requires_payment_method";
  const active = subscription?.status === "active";

  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="return-heading">
        <div>
          <p className="sectionKicker">Checkout</p>
          <h1 id="return-heading">
            {failed
              ? "That payment didn't go through"
              : active
                ? "You're subscribed"
                : "Payment received"}
          </h1>
          <p>
            {failed
              ? "No charge was made. Go back and try a different payment method."
              : active
                ? `Your ${subscription.planKey} subscription is active.`
                : "We're finishing setup — this usually takes a few seconds. Refresh if your subscription doesn't show as active shortly."}
          </p>
        </div>
      </section>
      <Link className="btn btn-primary" href="/">
        Go to your command center
      </Link>
    </main>
  );
}
