import {
  computeBusinessCoverageByPurpose,
  connectorCatalog,
} from "@signaldesk/integrations";
import {
  createDatabasePool,
  listActiveIntegrationSourceSystems,
} from "@signaldesk/persistence";
import type { Metadata } from "next";

import { purposeLabels, purposeQuestions } from "../_lib/connector-labels";
import { getCurrentOrganization } from "../_lib/session";
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
  const businessDataMap = computeBusinessCoverageByPurpose(connectedSlugs);

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
            Explore the connector foundation for communication, CRM, email,
            payments, accounting, calendars, and project delivery.
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
            <div key={coverage.purpose}>
              <dt>
                {purposeLabels[coverage.purpose]}
                <span className="coveragePurposeQuestion">
                  {purposeQuestions[coverage.purpose]}
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
                  {coverage.status === "connected"
                    ? "Live"
                    : coverage.status === "partial"
                      ? `${coverage.connectedConnectorNames.length} of ${coverage.totalConnectorNames.length} live`
                      : "Not connected"}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

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
              Most of these entries describe intended capabilities and safety
              gates, not live connections — HubSpot, QuickBooks, and Asana have
              real OAuth and sync built; the rest don&rsquo;t yet. Connect
              controls stay disabled for a connector until its own foundation is
              reviewed and built.
            </p>
          </div>
        </aside>
      ) : null}

      <IntegrationExplorer connectors={connectorCatalog} />
    </main>
  );
}
