import { detectInvoiceLeadNameDuplicates } from "@signaldesk/data-quality";
import {
  computeBusinessCoverageByCapability,
  computeIndustryCoverage,
  connectorCatalog,
  getSourceSystemLabel,
} from "@signaldesk/integrations";
import {
  computeTimeToFirstSync,
  createDatabasePool,
  getCsvImportSummary,
  getOrganizationBusinessProfile,
  listActiveIntegrationSourceSystems,
  listAllInvoices,
  listAllLeads,
} from "@signaldesk/persistence";
import type { Metadata } from "next";
import Link from "next/link";

import { CsvInvoiceImportForm } from "../_components/csv-invoice-import-form";
import { DataQualityPanel } from "../_components/data-quality-panel";
import { importCsvInvoicesAction } from "../_actions/import-csv-invoices";
import { previewCsvInvoiceImportAction } from "../_actions/preview-csv-invoice-import";
import {
  capabilityClassLabels,
  capabilityClassQuestions,
} from "../_lib/connector-labels";
import { getCurrentOrganization } from "../_lib/session";
import {
  describeCoverageStatus,
  describeTimeToFirstSync,
} from "../_lib/visual-state";
import { IntegrationExplorer } from "./integration-explorer";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "Connect the tools you already use, and see what's connected, what's available, and what's coming soon.",
};

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

export default async function IntegrationsPage() {
  const previewCount = connectorCatalog.filter(
    (connector) => connector.availability === "foundation-preview",
  ).length;
  const session = await getCurrentOrganization();
  const connectedSlugs = session
    ? await listActiveIntegrationSourceSystems(
        getPool(),
        session.organizationId,
      )
    : [];
  const liveConnections = connectedSlugs.length;
  const businessDataMap = computeBusinessCoverageByCapability(connectedSlugs);
  const businessProfile = session
    ? await getOrganizationBusinessProfile(getPool(), session.organizationId)
    : null;
  const industryCoverage = businessProfile
    ? computeIndustryCoverage(businessProfile.industry, connectedSlugs)
    : null;
  const csvImportSummary = session
    ? await getCsvImportSummary(getPool(), session.organizationId)
    : null;
  const dataQualityIssues = session
    ? detectInvoiceLeadNameDuplicates(
        ...(await Promise.all([
          listAllInvoices(getPool(), session.organizationId),
          listAllLeads(getPool(), session.organizationId),
        ])),
        new Date(),
      )
    : [];
  const timeToFirstSync = session
    ? await computeTimeToFirstSync(getPool(), session.organizationId)
    : null;

  return (
    <main className="shell appPage" id="main-content">
      <section
        className="pageHero integrationsHero"
        aria-labelledby="integrations-heading"
      >
        <div>
          <p className="sectionKicker">Integration hub</p>
          <h1 id="integrations-heading">
            Bring your business tools into one view.
          </h1>
          <p>
            Explore tools across CRM, communication, projects, accounting,
            payments, documents, contracts, support, and more.
          </p>
        </div>

        <dl className="integrationSnapshot" aria-label="Integration status">
          <div>
            <dt>Live connections</dt>
            <dd>{liveConnections}</dd>
          </div>
          <div>
            <dt>Tools listed</dt>
            <dd>{connectorCatalog.length}</dd>
          </div>
          <div>
            <dt>In progress</dt>
            <dd>{previewCount}</dd>
          </div>
        </dl>
      </section>

      {session && timeToFirstSync ? (
        <aside
          className="honestyNotice integrationNotice"
          aria-labelledby="time-to-first-sync-heading"
        >
          <span className="noticeIcon connectorNoticeIcon" aria-hidden="true">
            ↔
          </span>
          <div>
            <h2 id="time-to-first-sync-heading">
              {timeToFirstSync.firstSuccessfulSyncAt
                ? "Time to first real data"
                : "Getting to your first real data"}
            </h2>
            <p>{describeTimeToFirstSync(timeToFirstSync.minutesToFirstSync)}</p>
          </div>
        </aside>
      ) : null}

      <section className="businessCoverage" aria-labelledby="coverage-heading">
        <p className="sectionKicker">Business data map</p>
        <h2 id="coverage-heading">
          {session
            ? "Where your business actually lives"
            : "Where your business could live"}
        </h2>
        <p>
          {session
            ? "Computed from your organization's real, active connections — not the size of the catalog."
            : "Sign in to see your organization's real coverage; this is the catalog's shape."}
        </p>
        <dl className="coverageGrid">
          {businessDataMap.map((coverage) => (
            <div key={coverage.capabilityClass}>
              <dt>
                {capabilityClassLabels[coverage.capabilityClass]}
                <span className="coveragePurposeQuestion">
                  {capabilityClassQuestions[coverage.capabilityClass]}
                </span>
              </dt>
              <dd>
                <span className="coverageConnectorNames">
                  {(coverage.status === "none"
                    ? coverage.totalConnectorNames
                    : coverage.connectedConnectorNames
                  ).join(" + ")}
                </span>
                <span className={`readOnlyBadge coverage-${coverage.status}`}>
                  {describeCoverageStatus(coverage)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {session && industryCoverage ? (
        <section
          className="businessCoverage"
          aria-labelledby="industry-coverage-heading"
        >
          <p className="sectionKicker">Tailored to your business</p>
          <h2 id="industry-coverage-heading">
            Recommended for {industryCoverage.name}
          </h2>
          <p>
            The connector capabilities that matter most for this industry, based
            on the same real connection data above.
          </p>
          <dl className="coverageGrid">
            {industryCoverage.recommended.map((coverage) => (
              <div key={coverage.capabilityClass}>
                <dt>{capabilityClassLabels[coverage.capabilityClass]}</dt>
                <dd>
                  <span className={`readOnlyBadge coverage-${coverage.status}`}>
                    {describeCoverageStatus(coverage)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {session &&
      businessProfile &&
      businessProfile.industry === "unspecified" ? (
        <aside
          className="honestyNotice integrationNotice"
          aria-labelledby="industry-notice-heading"
        >
          <span className="noticeIcon connectorNoticeIcon" aria-hidden="true">
            ↔
          </span>
          <div>
            <h2 id="industry-notice-heading">Get tailored recommendations</h2>
            <p>
              Set your industry on your{" "}
              <Link href="/profile">business profile</Link> to see which
              connector capabilities matter most for your business.
            </p>
          </div>
        </aside>
      ) : null}

      {liveConnections === 0 ? (
        <aside
          className="honestyNotice integrationNotice"
          aria-labelledby="integration-notice-heading"
        >
          <span className="noticeIcon connectorNoticeIcon" aria-hidden="true">
            ↔
          </span>
          <div>
            <h2 id="integration-notice-heading">
              Not every tool is fully connectable yet
            </h2>
            <p>
              8 tools (HubSpot, QuickBooks, Asana, Gmail, Salesforce, Xero,
              Jira, Zendesk) connect and sync your real data today. 6 more
              (Slack, Microsoft Outlook, Stripe, Google Calendar, Microsoft
              Calendar, Linear) can be connected but don&rsquo;t bring data into
              SignalDesk yet. The remaining 11 aren&rsquo;t available to connect
              yet. You won&rsquo;t see a working Connect button for a tool until
              it&rsquo;s actually ready to use.
            </p>
          </div>
        </aside>
      ) : null}

      {session && csvImportSummary ? (
        <section
          className="csvImportSection"
          aria-labelledby="csv-import-heading"
        >
          <p className="sectionKicker">No connector yet? Bring your own data</p>
          <h2 id="csv-import-heading">Import invoices from a CSV</h2>
          <p>
            A real way to bring in data from a system we don&rsquo;t connect to
            yet — imported invoices show up alongside everything else, labeled
            honestly as CSV-imported so they&rsquo;re never mixed up with a live
            connection.
            {csvImportSummary.invoiceCount > 0
              ? ` ${csvImportSummary.invoiceCount} invoice${csvImportSummary.invoiceCount === 1 ? "" : "s"} imported so far.`
              : ""}
          </p>
          <CsvInvoiceImportForm
            previewAction={previewCsvInvoiceImportAction}
            importAction={importCsvInvoicesAction}
          />
        </section>
      ) : null}

      {session ? (
        <DataQualityPanel
          issues={dataQualityIssues}
          connectorName={getSourceSystemLabel}
        />
      ) : null}

      <IntegrationExplorer
        connectors={connectorCatalog}
        connectedSlugs={connectedSlugs}
      />
    </main>
  );
}
