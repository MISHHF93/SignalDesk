import {
  connectorCatalog,
  getConnectorBySlug,
  type ConnectorDefinition,
} from "@signaldesk/integrations";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConnectorMark } from "../../_components/connector-mark";
import { LockIcon } from "../../_components/icons";
import { categoryLabels } from "../../_lib/connector-labels";
import { getRequestOrigin } from "../../_lib/request-origin";
import { getCurrentOrganization } from "../../_lib/session";
import { oauthConnectorAdapters } from "./oauth-connectors";

export const dynamicParams = false;

function directionLabel(direction: ConnectorDefinition["direction"]): string {
  if (direction === "inbound") return "Provider to dashboard";
  if (direction === "outbound") return "Dashboard to provider";
  return "Provider and dashboard, both directions";
}

export function generateStaticParams() {
  return connectorCatalog.map((connector) => ({ slug: connector.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const connector = getConnectorBySlug(slug);

  return connector
    ? {
        title: `${connector.name} integration`,
        description: `Review the planned ${connector.name} connector capabilities and implementation gates.`,
      }
    : { title: "Integration not found" };
}

export default async function IntegrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const connector = getConnectorBySlug(slug);

  if (!connector) notFound();

  const adapter = oauthConnectorAdapters[connector.slug];
  const rawSearchParams = adapter ? await searchParams : undefined;
  const callbackStatusRaw = adapter
    ? rawSearchParams?.[adapter.statusQueryParam]
    : undefined;
  const callbackStatus =
    typeof callbackStatusRaw === "string" ? callbackStatusRaw : undefined;
  const syncedRaw = rawSearchParams?.synced;
  const parsedSyncedCount =
    typeof syncedRaw === "string" ? Number(syncedRaw) : NaN;
  const syncedCount =
    Number.isInteger(parsedSyncedCount) && parsedSyncedCount >= 0
      ? parsedSyncedCount
      : 0;

  const session = adapter ? await getCurrentOrganization() : null;
  const redirectUri = adapter
    ? `${await getRequestOrigin()}${adapter.callbackPath}`
    : "";
  const integrationStatus =
    adapter && session ? await adapter.getStatus(session.organizationId) : null;
  const isConnected = integrationStatus?.status === "active";
  // `callbackStatus`/`synced` are unvalidated query-string values — anyone
  // can browse to `?hubspot=connected&synced=999999999` regardless of their
  // real connection state. Only render a "connected"/"disconnected" banner
  // when it's corroborated by `isConnected`, which comes from the real,
  // session-scoped DB read above, not from client input — otherwise this
  // page would show fabricated sync status to an arbitrary visitor.
  const showConnectedBanner = callbackStatus === "connected" && isConnected;
  const showDisconnectedBanner =
    callbackStatus === "disconnected" && !isConnected;

  const readinessItems = [
    { label: "Catalog metadata", ready: connector.readiness.catalogMetadata },
    {
      label: "Provider adapter",
      ready: connector.readiness.adapterImplemented,
    },
    {
      label: "Authorization flow",
      ready: connector.readiness.authorizationImplemented,
    },
    { label: "Background sync", ready: connector.readiness.syncImplemented },
    {
      label: "External actions",
      ready: connector.readiness.actionsImplemented,
    },
    {
      label: "Production readiness",
      ready: connector.readiness.productionReady,
    },
  ] as const;
  const readyItemCount = readinessItems.filter((item) => item.ready).length;

  return (
    <main className="shell appPage connectorDetailPage" id="main-content">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/integrations">Integrations</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{connector.name}</span>
      </nav>

      {showConnectedBanner ? (
        <p
          className="hubspotSyncStatus hubspotSyncStatus-connected"
          role="status"
        >
          {connector.slug === "hubspot" ? (
            <>
              Connected. Synced {syncedCount} deal
              {syncedCount === 1 ? "" : "s"} from HubSpot into your workspace.
            </>
          ) : connector.slug === "quickbooks" ? (
            <>
              Connected. Synced {syncedCount} overdue invoice
              {syncedCount === 1 ? "" : "s"} from QuickBooks into your
              workspace.
            </>
          ) : connector.slug === "asana" ? (
            <>
              Connected. Synced {syncedCount} overdue task
              {syncedCount === 1 ? "" : "s"} from Asana into your workspace.
            </>
          ) : (
            <>
              Connected to{" "}
              {integrationStatus?.externalAccountLabel ??
                `your ${adapter?.providerLabel} account`}
              .
            </>
          )}
        </p>
      ) : null}
      {adapter && callbackStatus === "limit" ? (
        <p className="hubspotSyncStatus hubspotSyncStatus-denied" role="alert">
          You&rsquo;ve reached your plan&rsquo;s active connection limit.{" "}
          <Link href="/pricing">Upgrade your plan</Link> or disconnect another
          integration to connect {adapter.providerLabel}.
        </p>
      ) : null}
      {adapter && callbackStatus === "denied" ? (
        <p className="hubspotSyncStatus hubspotSyncStatus-denied" role="alert">
          {adapter.providerLabel} authorization was cancelled or denied.
        </p>
      ) : null}
      {adapter && callbackStatus === "error" ? (
        <p className="hubspotSyncStatus hubspotSyncStatus-error" role="alert">
          Something went wrong connecting {adapter.providerLabel}. Please try
          again.
        </p>
      ) : null}
      {showDisconnectedBanner ? (
        <p
          className="hubspotSyncStatus hubspotSyncStatus-connected"
          role="status"
        >
          Disconnected. Your {adapter?.providerLabel} tokens have been deleted;
          no further sync will happen until you reconnect.
        </p>
      ) : null}

      <section
        className="connectorDetailHero"
        aria-labelledby="connector-heading"
      >
        <div className="connectorDetailIdentity">
          <ConnectorMark connector={connector} size="large" />
          <div>
            <div className="badgeRow connectorDetailBadges">
              <span
                className={`availabilityBadge ${connector.availability === "foundation-preview" ? "preview" : "planned"}`}
              >
                {connector.availability === "foundation-preview"
                  ? "Foundation preview"
                  : "Planned"}
              </span>
              <span className="readOnlyBadge">
                {isConnected ? "Connected" : "Not connected"}
              </span>
            </div>
            <p className="sectionKicker">
              {categoryLabels[connector.category]}
            </p>
            <h1 id="connector-heading">{connector.name}</h1>
            <p>{connector.shortDescription}</p>
          </div>
        </div>

        {adapter ? (
          <div className="connectPanel" aria-labelledby="connect-heading">
            <p className="sectionKicker">Connection status</p>
            {isConnected ? (
              <>
                <h2 id="connect-heading">Connected</h2>
                <p>
                  {adapter.connectedDescription(
                    integrationStatus?.externalAccountLabel ?? null,
                  )}
                </p>
                <adapter.DisconnectButton />
              </>
            ) : !adapter.isConfigured() ? (
              <>
                <h2 id="connect-heading">Developer setup required</h2>
                <p id="connect-explanation">
                  The OAuth flow and token storage are real and tested — this
                  app just doesn&rsquo;t have a {adapter.providerLabel}{" "}
                  developer app registered yet. That&rsquo;s a one-time step for
                  whoever runs this app, not something done per sign-in.
                </p>
                <ol className="setupSteps">
                  {adapter.setupSteps(redirectUri)}
                </ol>
                <p
                  className="connectStatus"
                  aria-describedby="connect-explanation"
                >
                  <LockIcon className="lockIcon" />
                  Connection unavailable until those env vars are set
                </p>
              </>
            ) : !session ? (
              <>
                <h2 id="connect-heading">Sign in to connect</h2>
                <p>
                  <Link href={`/login?next=/integrations/${connector.slug}`}>
                    Sign in
                  </Link>{" "}
                  to connect your {adapter.providerLabel} account.
                </p>
              </>
            ) : (
              <>
                <h2 id="connect-heading">Ready to connect</h2>
                <p>{adapter.readyToConnectDescription()}</p>
                <adapter.ConnectButton />
              </>
            )}
          </div>
        ) : (
          <div className="connectPanel" aria-labelledby="connect-heading">
            <p className="sectionKicker">Connection status</p>
            <h2 id="connect-heading">Setup is intentionally unavailable</h2>
            <p id="connect-explanation">
              OAuth, provider scopes, and token storage have not been
              configured. This control does not launch or imitate an
              authorization flow.
            </p>
            <p className="connectStatus" aria-describedby="connect-explanation">
              <LockIcon className="lockIcon" />
              Connection unavailable
            </p>
            <small>No credentials are requested or stored.</small>
          </div>
        )}
      </section>

      <section className="connectorOverview" aria-labelledby="overview-heading">
        <div className="detailSectionHeading">
          <p className="sectionKicker">Designed behavior</p>
          <h2 id="overview-heading">What this connector could support</h2>
          <p>
            Capability descriptions are product intent, not claims of live
            provider access.
          </p>
        </div>

        <div className="capabilityGrid">
          {connector.capabilities.map((capability) => (
            <article className="capabilityCard" key={capability.id}>
              <span className={`operationBadge ${capability.operation}`}>
                {capability.operation === "read"
                  ? "Read intent"
                  : "Write intent"}
              </span>
              <h3>{capability.label}</h3>
              <p>{capability.description}</p>
              {capability.operation === "write" ? (
                <small>
                  A future write would require explicit approval, audit logging,
                  idempotency, and a fresh preflight check.
                </small>
              ) : (
                <small>
                  A future read would be tenant-scoped and retain source
                  provenance.
                </small>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="connectorDetailGrid">
        <section className="detailCard" aria-labelledby="data-flow-heading">
          <div className="detailCardHeader">
            <div>
              <p className="sectionKicker">Data posture</p>
              <h2 id="data-flow-heading">Intended data flow</h2>
            </div>
            <span className="readOnlyBadge">
              {connector.accessPosture === "read-only"
                ? "Read-only intent"
                : "Read + governed writes"}
            </span>
          </div>

          <div
            className="dataFlow"
            role="img"
            aria-label={directionLabel(connector.direction)}
          >
            <span>{connector.name}</span>
            <span className="flowArrow" aria-hidden="true">
              {connector.direction === "bidirectional"
                ? "⇄"
                : connector.direction === "inbound"
                  ? "→"
                  : "←"}
            </span>
            <span>Command center</span>
          </div>

          <dl className="detailFacts">
            <div>
              <dt>Direction</dt>
              <dd>{directionLabel(connector.direction)}</dd>
            </div>
            <div>
              <dt>Authorization design</dt>
              <dd>{connector.authStrategy.label}</dd>
            </div>
            <div>
              <dt>Provider scopes</dt>
              <dd>
                {connector.authStrategy.scopesDefined &&
                connector.authStrategy.scopes
                  ? connector.authStrategy.scopes.join(", ")
                  : "Not selected"}
              </dd>
            </div>
            <div>
              <dt>Current access</dt>
              <dd>{isConnected ? "Connected" : "None"}</dd>
            </div>
          </dl>
        </section>

        <section className="detailCard" aria-labelledby="readiness-heading">
          <div className="detailCardHeader">
            <div>
              <p className="sectionKicker">Reality check</p>
              <h2 id="readiness-heading">Implementation readiness</h2>
            </div>
            <span className="readinessCount">
              {readyItemCount} of {readinessItems.length}
            </span>
          </div>

          <ul className="readinessList">
            {readinessItems.map((item) => (
              <li key={item.label}>
                <span
                  className={`readinessState ${item.ready ? "ready" : "required"}`}
                  aria-hidden="true"
                >
                  {item.ready ? "✓" : "–"}
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.ready ? "Defined" : "Not implemented"}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="implementationGates" aria-labelledby="gates-heading">
        <div className="detailSectionHeading">
          <p className="sectionKicker">Before connection</p>
          <h2 id="gates-heading">Required implementation gates</h2>
          <p>
            Every item must be designed, tested, and reviewed before this
            connector can handle real workspace data.
          </p>
        </div>

        <ol>
          {connector.implementationGates.map((gate, index) => (
            <li key={gate.id}>
              <span aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <strong>{gate.label}</strong>
                <small>Required · not complete</small>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <aside className="connectorSecurityNote">
        <div>
          <p className="sectionKicker">Safe by default</p>
          <h2>
            {adapter
              ? adapter.securityNoteHeading
              : "Nothing leaves this prototype."}
          </h2>
        </div>
        <p>
          {adapter ? (
            adapter.securityNoteBody
          ) : (
            <>
              The catalog contains metadata only. It has no provider SDK, client
              secret, redirect URI, webhook endpoint, token, scheduled job, or
              action executor. The source system would remain authoritative when
              a real adapter is eventually introduced.
            </>
          )}
        </p>
      </aside>
    </main>
  );
}
