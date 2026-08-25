import {
  getConnectorBySlug,
  type ConnectorDefinition,
} from "@signaldesk/integrations";
import {
  computeConnectorHealth,
  createDatabasePool,
  type DatabasePool,
} from "@signaldesk/persistence";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConnectorMark } from "../../_components/connector-mark";
import { LockIcon } from "../../_components/icons";
import { capabilityClassLabels } from "../../_lib/connector-labels";
import { isLocalDevelopment } from "../../_lib/environment";
import { getRequestOrigin } from "../../_lib/request-origin";
import { getCurrentOrganization } from "../../_lib/session";
import { describeConnectorHealth } from "../../_lib/visual-state";
import { oauthConnectorAdapters } from "./oauth-connectors";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

function directionLabel(direction: ConnectorDefinition["direction"]): string {
  if (direction === "inbound") return "Brings data in";
  if (direction === "outbound") return "Sends data out";
  return "Two-way sync";
}

/**
 * Shared by the full-page route (`[slug]/page.tsx`, the real destination for
 * OAuth callback redirects and direct links) and the intercepted drawer
 * route (root `@modal/(.)integrations/[slug]/page.tsx`, what any real
 * in-app `<Link>` click opens instead — the `/integrations` list itself or
 * a Today card) — one data-fetching/rendering path, not two copies that
 * could drift.
 */
export async function ConnectorDetailContent({
  slug,
  rawSearchParams,
}: {
  slug: string;
  rawSearchParams: Record<string, string | string[] | undefined>;
}) {
  const connector = getConnectorBySlug(slug);

  if (!connector) notFound();

  const adapter = oauthConnectorAdapters[connector.slug];
  const callbackStatusRaw = adapter
    ? rawSearchParams[adapter.statusQueryParam]
    : undefined;
  const callbackStatus =
    typeof callbackStatusRaw === "string" ? callbackStatusRaw : undefined;
  const syncedRaw = rawSearchParams.synced;
  const parsedSyncedCount =
    typeof syncedRaw === "string" ? Number(syncedRaw) : NaN;
  const syncedCount =
    Number.isInteger(parsedSyncedCount) && parsedSyncedCount >= 0
      ? parsedSyncedCount
      : 0;

  const session = adapter ? await getCurrentOrganization() : null;
  // The real enforcement is server-side, on every connect/disconnect
  // Server Action itself (each independently re-derives this from its own
  // session, never trusts a client prop) — this is the matching UI-side
  // signal so a member sees an honest, explanatory state instead of a
  // button that would just fail with a permissions error when clicked.
  const canManageConnections =
    session !== null && (session.role === "owner" || session.role === "admin");
  const redirectUri = adapter
    ? `${await getRequestOrigin()}${adapter.callbackPath}`
    : "";
  const integrationStatus =
    adapter && session ? await adapter.getStatus(session.organizationId) : null;
  const isConnected =
    integrationStatus?.status === "active" ||
    integrationStatus?.status === "degraded";
  // A degraded connection is still a live one (real tokens, real sync) —
  // just one where a recent sync run couldn't parse one or more records
  // (Prompt 34, docs/product-vision-backlog.md, ADR 0043). Kept distinct
  // from `isConnected` so `degraded` never gets mistaken for
  // `disconnected` anywhere this page renders connection state.
  const isDegraded = integrationStatus?.status === "degraded";
  // `callbackStatus`/`synced` are unvalidated query-string values — anyone
  // can browse to `?hubspot=connected&synced=999999999` regardless of their
  // real connection state. Only render a "connected"/"disconnected" banner
  // when it's corroborated by `isConnected`, which comes from the real,
  // session-scoped DB read above, not from client input — otherwise this
  // page would show fabricated sync status to an arbitrary visitor.
  const showConnectedBanner = callbackStatus === "connected" && isConnected;
  const showDisconnectedBanner =
    callbackStatus === "disconnected" && !isConnected;

  // Only real for the 3 connectors with real sync-on-connect — computed
  // from real sync_jobs rows (ADR 0021), never a placeholder.
  const health =
    adapter &&
    session &&
    isConnected &&
    connector.readiness.initialSyncImplemented &&
    integrationStatus
      ? await computeConnectorHealth(
          getPool(),
          session.organizationId,
          integrationStatus.id,
        )
      : null;

  // `syncImplemented` specifically means a timer-driven background poller
  // (see its doc comment in packages/integrations/src/index.ts) and is
  // false for every connector today — including the 8 with real,
  // tested sync via the initial+incremental cursor pattern (Gmail,
  // HubSpot, QuickBooks, Asana, Salesforce, Jira, Xero, Zendesk). Reads
  // are honestly "live" once that initial sync exists, regardless of
  // which sync mechanism produced it — checking `syncImplemented` alone
  // here previously made every read capability show "Planned" even for
  // connectors this exact page's own "Connected. Synced N..." banner
  // already proves are real.
  const hasRealRead = connector.readiness.initialSyncImplemented;

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
      label: "Incremental sync",
      ready: connector.readiness.incrementalSyncImplemented,
    },
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
    <>
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
          ) : connector.slug === "gmail" ? (
            <>
              Connected. Synced {syncedCount} message
              {syncedCount === 1 ? "" : "s"} from Gmail into your workspace.
            </>
          ) : connector.slug === "salesforce" ? (
            <>
              Connected. Synced {syncedCount} opportunit
              {syncedCount === 1 ? "y" : "ies"} from Salesforce into your
              workspace.
            </>
          ) : connector.slug === "xero" ? (
            <>
              Connected. Synced {syncedCount} invoice
              {syncedCount === 1 ? "" : "s"} from Xero into your workspace.
            </>
          ) : connector.slug === "jira" ? (
            <>
              Connected. Synced {syncedCount} issue
              {syncedCount === 1 ? "" : "s"} from Jira into your workspace.
            </>
          ) : connector.slug === "zendesk" ? (
            <>
              Connected. Synced {syncedCount} ticket
              {syncedCount === 1 ? "" : "s"} from Zendesk into your workspace.
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
                  ? "In progress"
                  : "Coming soon"}
              </span>
              <span className="readOnlyBadge">
                {isConnected ? "Connected" : "Not connected"}
              </span>
            </div>
            <p className="sectionKicker">
              {capabilityClassLabels[connector.capabilityClasses[0]!]}
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
                {health ? (
                  <>
                    <p
                      className={`connectorHealthStatus connectorHealthStatus--${health.status}`}
                    >
                      {describeConnectorHealth(health, new Date())}
                    </p>
                    {health.status === "error" && health.lastError ? (
                      <dl className="detailFacts">
                        <div>
                          <dt>Last error</dt>
                          <dd>{health.lastError}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </>
                ) : null}
                {isDegraded ? (
                  <p className="integrationDegradedNotice" role="status">
                    A recent sync couldn&rsquo;t parse one or more records from{" "}
                    {connector.name} — data from this connector may be
                    incomplete until this is resolved. It will clear
                    automatically the next time a sync completes with nothing
                    skipped.
                  </p>
                ) : null}
                <div className="connectPanelActions">
                  {adapter.SyncButton ? <adapter.SyncButton /> : null}
                  {canManageConnections ? (
                    <adapter.DisconnectButton />
                  ) : (
                    <p className="connectorRoleNotice">
                      Only an owner or admin can disconnect this integration.
                    </p>
                  )}
                </div>
              </>
            ) : !adapter.isConfigured() ? (
              isLocalDevelopment() ? (
                <>
                  <h2 id="connect-heading">Developer setup required</h2>
                  <p id="connect-explanation">
                    The OAuth flow and token storage are real and tested — this
                    app just doesn&rsquo;t have a {adapter.providerLabel}{" "}
                    developer app registered yet. That&rsquo;s a one-time step
                    for whoever runs this app, not something done per sign-in.
                    This detailed setup guidance only shows in local development
                    (see <code>isLocalDevelopment()</code>,{" "}
                    <code>_lib/environment.ts</code>) — a real deployment shows
                    a plain &ldquo;temporarily unavailable&rdquo; message here
                    instead.
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
              ) : (
                <>
                  <h2 id="connect-heading">
                    {adapter.providerLabel} connection is temporarily
                    unavailable
                  </h2>
                  <p id="connect-explanation">
                    This isn&rsquo;t something you need to do anything about —
                    SignalDesk hasn&rsquo;t finished setting up{" "}
                    {adapter.providerLabel} connections for this workspace yet.
                    Your other connected systems and existing data are
                    unaffected.
                  </p>
                  <p
                    className="connectStatus"
                    aria-describedby="connect-explanation"
                  >
                    <LockIcon className="lockIcon" />
                    Connection unavailable
                  </p>
                </>
              )
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
            ) : !canManageConnections ? (
              <>
                <h2 id="connect-heading">Owner or admin required</h2>
                <p>
                  Ask an owner or admin on this workspace to connect{" "}
                  {adapter.providerLabel}.
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
            <h2 id="connect-heading">Not available yet</h2>
            <p id="connect-explanation">
              SignalDesk doesn&rsquo;t support connecting to {connector.name}{" "}
              yet — there&rsquo;s no button here because there&rsquo;s nothing
              real to click. No credentials are requested or stored.
            </p>
            <p className="connectStatus" aria-describedby="connect-explanation">
              <LockIcon className="lockIcon" />
              Connection unavailable
            </p>
          </div>
        )}
      </section>

      <section className="connectorOverview" aria-labelledby="overview-heading">
        <div className="detailSectionHeading">
          <p className="sectionKicker">
            {hasRealRead ? "What SignalDesk sees" : "Designed behavior"}
          </p>
          <h2 id="overview-heading">
            {hasRealRead
              ? `What ${connector.name} brings into SignalDesk`
              : "What this connector could support"}
          </h2>
          <p>
            {hasRealRead && connector.readiness.actionsImplemented
              ? "Reads below are real once connected — and one write is too, always behind your explicit approval."
              : hasRealRead
                ? "Writes aren't live yet — reads below are real once connected."
                : "These are planned capabilities, not something you can use yet."}
          </p>
        </div>

        <div className="capabilityGrid">
          {connector.capabilities.map((capability) => {
            const isLive =
              (capability.operation === "read" && hasRealRead) ||
              (capability.operation === "write" &&
                connector.readiness.actionsImplemented);

            return (
              <article className="capabilityCard" key={capability.id}>
                <span className={`operationBadge ${capability.operation}`}>
                  {isLive
                    ? "Live"
                    : capability.operation === "read"
                      ? "Planned"
                      : "Planned write"}
                </span>
                <h3>{capability.label}</h3>
                <p>{capability.description}</p>
                {isLive && capability.operation === "write" ? (
                  <small>
                    Requires your explicit approval every time — nothing is sent
                    automatically.
                  </small>
                ) : isLive ? (
                  <small>
                    Tenant-scoped, and every record keeps a trace back to{" "}
                    {connector.name}.
                  </small>
                ) : capability.operation === "write" ? (
                  <small>
                    Not available yet — a future write would need your explicit
                    approval every time, not just once at connect.
                  </small>
                ) : (
                  <small>Not available to connect yet.</small>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="detailCard" aria-labelledby="data-flow-heading">
        <div className="detailCardHeader">
          <div>
            <p className="sectionKicker">Data posture</p>
            <h2 id="data-flow-heading">Intended data flow</h2>
          </div>
          <span className="readOnlyBadge">
            {connector.accessPosture === "read-only"
              ? "Read-only"
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

      {!connector.readiness.productionReady ? (
        <details className="implementationGates">
          <summary>
            Not fully available yet — see what SignalDesk still needs to build
            for {connector.name}
          </summary>
          <div className="detailSectionHeading">
            <p className="sectionKicker">Reality check</p>
            <h2 id="readiness-heading">Implementation readiness</h2>
            <p>
              {readyItemCount} of {readinessItems.length} steps done.
            </p>
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
        </details>
      ) : null}

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
    </>
  );
}
