import { detectInvoiceLeadNameDuplicates } from "@signaldesk/data-quality";
import {
  computeBusinessCoverageByCapability,
  computeIndustryCoverage,
  connectorCatalog,
  getConnectorBySlug,
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
    "Explore planned business connectors and their honest implementation readiness.",
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
            Explore the connector foundation across CRM, communication,
            projects, accounting, payments, documents, contracts, support, and
            more.
          </p>
        </div>

        <dl className="integrationSnapshot" aria-label="Integration status">
          <div>
            <dt>Live connections</dt>
            <dd>{liveConnections}</dd>
          </div>
          <div>
            <dt>Catalog entries</dt>
            <dd>{connectorCatalog.length}</dd>
          </div>
          <div>
            <dt>Foundation previews</dt>
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
              Catalog implemented; most connectivity is not
            </h2>
            <p>
              25 catalog entries, three real tiers: 8 (HubSpot, QuickBooks,
              Asana, Gmail, Salesforce, Xero, Jira, Zendesk) have real OAuth and
              a real sync into your Business Graph; 6 more (Slack, Microsoft
              Outlook, Stripe, Google Calendar, Microsoft Calendar, Linear) have
              real OAuth but no sync yet; the remaining 11 describe intended
              capabilities and safety gates only — no connection exists yet.
              Connect controls stay disabled for a connector until its own
              foundation is reviewed and built.
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
            A real, governed escape hatch for a system with no connector —
            imported invoices flow through the same Business Graph as a live
            sync, labeled honestly as CSV-imported, never mixed up with a live
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
          connectorName={(system) => getConnectorBySlug(system)?.name ?? system}
        />
      ) : null}

      <IntegrationExplorer connectors={connectorCatalog} />
    </main>
  );
}
