import { getConnectorBySlug } from "@signaldesk/integrations";
import {
  createDatabasePool,
  getInternalCostSummary,
  listConnectorConnections,
  listRecentAgentDelegationGrants,
  type DatabasePool,
} from "@signaldesk/persistence";
import type { Metadata } from "next";
import Link from "next/link";

import { formatEventType } from "../_cards/format";
import { isAgentFabricEnabled, isClaudeConfigured } from "../_lib/agent-config";
import { getCurrentOrganization } from "../_lib/session";

export const dynamic = "force-dynamic";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export const metadata: Metadata = {
  title: "Trust Center",
  description:
    "What's connected, what AI can do, and what's been granted to it — one real, read-only page.",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function TrustCenterPage() {
  const session = await getCurrentOrganization();

  if (!session) {
    return (
      <main className="shell appPage" id="main-content">
        <section className="pageHero" aria-labelledby="trust-heading">
          <div>
            <p className="sectionKicker">Trust &amp; safety</p>
            <h1 id="trust-heading">Trust Center</h1>
            <p>Sign in to see this workspace&rsquo;s trust disclosures.</p>
          </div>
        </section>
      </main>
    );
  }

  if (session.role !== "owner") {
    return (
      <main className="shell appPage" id="main-content">
        <section className="pageHero" aria-labelledby="trust-heading">
          <div>
            <p className="sectionKicker">Trust &amp; safety</p>
            <h1 id="trust-heading">Trust Center</h1>
            <p>Only the workspace owner can view the Trust Center.</p>
          </div>
        </section>
      </main>
    );
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [connections, grants, costSummary] = await Promise.all([
    listConnectorConnections(getPool(), session.organizationId),
    listRecentAgentDelegationGrants(getPool(), session.organizationId),
    getInternalCostSummary(getPool(), session.organizationId, thirtyDaysAgo),
  ]);

  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="trust-heading">
        <div>
          <p className="sectionKicker">Trust &amp; safety</p>
          <h1 id="trust-heading">Trust Center</h1>
          <p>
            One real, read-only page: exactly what&rsquo;s connected to this
            workspace, what AI is and isn&rsquo;t allowed to do, and every real
            permission it has actually been granted. No toggles here yet — this
            discloses real state, it doesn&rsquo;t change it.
          </p>
        </div>
      </section>

      <div className="profileGrid">
        <section
          className="settingsCard"
          aria-labelledby="trust-connections-heading"
        >
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Connected systems</p>
              <h2 id="trust-connections-heading">
                What&rsquo;s connected right now
              </h2>
            </div>
            <span className="readOnlyBadge">Real</span>
          </div>

          {connections.length === 0 ? (
            <p>
              No live connections yet.{" "}
              <Link href="/integrations">Connect a tool</Link> to see it here.
            </p>
          ) : (
            connections.map((connection) => {
              const connector = getConnectorBySlug(connection.sourceSystem);
              return (
                <dl className="settingsList" key={connection.id}>
                  <div>
                    <dt>{connector?.name ?? connection.sourceSystem}</dt>
                    <dd>
                      {connection.status === "degraded"
                        ? "Connected — degraded (a recent sync couldn't parse some records)"
                        : "Connected"}
                      {connection.externalAccountLabel
                        ? ` · ${connection.externalAccountLabel}`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Connected since</dt>
                    <dd>{formatDate(connection.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Requested scopes</dt>
                    <dd>
                      {connector?.authStrategy.scopesDefined &&
                      connector.authStrategy.scopes
                        ? connector.authStrategy.scopes.join(", ")
                        : "Not disclosed by this provider's catalog entry"}
                    </dd>
                  </div>
                </dl>
              );
            })
          )}
          <p className="trustFootnote">
            Scopes shown are this connector&rsquo;s catalog-declared OAuth
            request, not a per-connection audit of what the provider actually
            granted — real detail per connector lives on{" "}
            <Link href="/integrations">Integrations</Link>.
          </p>
        </section>

        <section className="settingsCard" aria-labelledby="trust-ai-heading">
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Kill switches</p>
              <h2 id="trust-ai-heading">What AI can do here</h2>
            </div>
            <span
              className={
                isAgentFabricEnabled() ? "readOnlyBadge" : "plannedBadge"
              }
            >
              {isAgentFabricEnabled() ? "Agent Fabric enabled" : "Disabled"}
            </span>
          </div>

          <dl className="settingsList">
            <div>
              <dt>AGENT_FABRIC_ENABLED</dt>
              <dd>
                {isAgentFabricEnabled()
                  ? "true — real specialist investigations can run"
                  : "unset — investigations are inert, no specialist runs"}
              </dd>
            </div>
            <div>
              <dt>ANTHROPIC_API_KEY</dt>
              <dd>
                {isClaudeConfigured()
                  ? "configured — the Claude specialist is available"
                  : "unset — every investigation resolves to the deterministic specialist"}
              </dd>
            </div>
            <div>
              <dt>Can any agent execute an action directly?</dt>
              <dd>
                No — every agent&rsquo;s <code>canExecute</code> is hard-coded
                false. Agents can only propose; a human always approves or
                dismisses before anything real happens.
              </dd>
            </div>
          </dl>
          <p className="trustFootnote">
            Full agent directory and collaboration trace:{" "}
            <Link href="/agents">Agents</Link>.
          </p>
        </section>

        <section className="settingsCard" aria-labelledby="trust-usage-heading">
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Usage</p>
              <h2 id="trust-usage-heading">Real AI usage, last 30 days</h2>
            </div>
            <span className="readOnlyBadge">Real</span>
          </div>

          {costSummary.length === 0 ? (
            <p>
              No AI-provider call has happened in this workspace in the last 30
              days. This only counts calls to a real model provider (the
              deterministic specialist has zero marginal cost and isn&rsquo;t
              tracked here).
            </p>
          ) : (
            <dl className="settingsList">
              {costSummary.map((row) => (
                <div key={row.eventType}>
                  <dt>{formatEventType(row.eventType)}</dt>
                  <dd>
                    {row.eventCount} call{row.eventCount === 1 ? "" : "s"}
                    {row.totalEstimatedCostCents > 0
                      ? ` · $${(row.totalEstimatedCostCents / 100).toFixed(2)}`
                      : " · cost not yet priced"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="trustFootnote">
            Internal instrumentation only (ADR 0045) — never used to bill this
            workspace. No per-token pricing table exists yet, so real calls are
            counted honestly without a fabricated dollar figure until one does.
          </p>
        </section>

        <section
          className="settingsCard"
          aria-labelledby="trust-grants-heading"
        >
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Audit</p>
              <h2 id="trust-grants-heading">Real permissions granted to AI</h2>
            </div>
            <span className="readOnlyBadge">Real</span>
          </div>

          {grants.length === 0 ? (
            <p>
              No capability has ever been granted to an agent in this workspace.
              A grant is minted only when a real investigation runs, and expires
              within minutes.
            </p>
          ) : (
            grants.map((grant) => (
              <dl className="settingsList" key={grant.id}>
                <div>
                  <dt>
                    {grant.agentId} · {grant.capability}
                  </dt>
                  <dd>
                    {grant.expiresAt.getTime() > now.getTime()
                      ? `Active until ${formatDate(grant.expiresAt)}`
                      : `Expired ${formatDate(grant.expiresAt)}`}
                  </dd>
                </div>
                <div>
                  <dt>Granted</dt>
                  <dd>{formatDate(grant.createdAt)}</dd>
                </div>
                <div>
                  <dt>Could propose an action?</dt>
                  <dd>{grant.canPropose ? "Yes" : "No"}</dd>
                </div>
              </dl>
            ))
          )}
        </section>

        <section className="settingsCard" aria-labelledby="trust-data-heading">
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Your data</p>
              <h2 id="trust-data-heading">Export or delete everything</h2>
            </div>
            <span className="readOnlyBadge">Real</span>
          </div>
          <p>
            A real, live-database-tested export of every record this workspace
            holds, and a real anonymize-on-delete path — both on{" "}
            <Link href="/profile">your profile</Link>, not rebuilt here.
          </p>
        </section>
      </div>
    </main>
  );
}
