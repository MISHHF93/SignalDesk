import type { Metadata } from "next";

import {
  createDatabasePool,
  getPlanCatalog,
  type DatabasePool,
} from "@signaldesk/persistence";

import { PricingTable } from "./pricing-table";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Plans priced by team size and active connections, not by usage you can't predict.",
};

export default async function PricingPage() {
  const catalog = await getPlanCatalog(getPool());

  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="pricing-heading">
        <div>
          <p className="sectionKicker">Pricing</p>
          <h1 id="pricing-heading">One page for the whole business.</h1>
          <p>
            Every paid plan gets the full command center — Business Graph,
            Attention Engine, Daily Brief, connector health, and Ask Your
            Business AI. Plans differ by team size, active connections, and
            operational sophistication, not by which features are locked away.
          </p>
        </div>
      </section>

      <PricingTable plans={catalog} />

      <aside className="honestyNotice" aria-labelledby="pricing-notice-heading">
        <span className="noticeIcon" aria-hidden="true">
          ↔
        </span>
        <div>
          <h2 id="pricing-notice-heading">
            Billed by active connections, not by usage
          </h2>
          <p>
            An active connection is one authenticated account or workspace you
            keep connected — Slack, a Gmail inbox, a QuickBooks company file. We
            never bill by tokens, webhooks, synced records, or AI calls.
          </p>
        </div>
      </aside>
    </main>
  );
}
