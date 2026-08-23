import { AGENT_REGISTRY, summarizeCardFeedback } from "@signaldesk/application";
import {
  createDatabasePool,
  listAgentTaskResultsForCollaborations,
  listRecentAgentCollaborations,
  listRecentCardFeedback,
  type AgentCollaboration,
  type AgentTaskResultRecord,
  type DatabasePool,
} from "@signaldesk/persistence";
import type { Metadata } from "next";
import Link from "next/link";

import { isAgentFabricEnabled, isClaudeConfigured } from "../_lib/agent-config";
import { availabilityFor } from "../_lib/agent-fabric";
import { getCurrentOrganization } from "../_lib/session";

export const dynamic = "force-dynamic";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export const metadata: Metadata = {
  title: "Agents",
  description:
    "Agent Fabric directory, collaboration trace, and real card feedback.",
};

interface CollaborationWithResults {
  readonly collaboration: AgentCollaboration;
  readonly results: readonly AgentTaskResultRecord[];
}

function formatConfidence(basisPoints: number | null): string {
  return basisPoints === null ? "—" : `${Math.round(basisPoints / 100)}%`;
}

function formatReviewedAt(reviewedAt: Date | null): string {
  return reviewedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(reviewedAt)
    : "—";
}

export default async function AgentsPage() {
  const session = await getCurrentOrganization();

  if (!session) {
    return (
      <main className="shell appPage" id="main-content">
        <section className="pageHero" aria-labelledby="agents-heading">
          <div>
            <p className="sectionKicker">AI &amp; automation</p>
            <h1 id="agents-heading">Agents</h1>
            <p>
              Sign in to see this workspace&rsquo;s Agent Fabric configuration.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (session.role !== "owner") {
    return (
      <main className="shell appPage" id="main-content">
        <section className="pageHero" aria-labelledby="agents-heading">
          <div>
            <p className="sectionKicker">AI &amp; automation</p>
            <h1 id="agents-heading">Agents</h1>
            <p>
              Only the workspace owner can view the Agent Fabric configuration.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const availability = availabilityFor();
  const collaborations = await listRecentAgentCollaborations(
    getPool(),
    session.organizationId,
  );
  // One batched query for every collaboration's results, not one query
  // per collaboration (a real N+1 this used to be — up to 20 extra
  // round trips on every page load).
  const allResults = await listAgentTaskResultsForCollaborations(
    getPool(),
    session.organizationId,
    collaborations.map((collaboration) => collaboration.id),
  );
  const trace: readonly CollaborationWithResults[] = collaborations.map(
    (collaboration) => ({
      collaboration,
      results: allResults.filter(
        (result) => result.collaborationId === collaboration.id,
      ),
    }),
  );
  const recentFeedback = await listRecentCardFeedback(
    getPool(),
    session.organizationId,
  );
  const feedbackSummary = summarizeCardFeedback(recentFeedback);

  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="agents-heading">
        <div>
          <p className="sectionKicker">AI &amp; automation</p>
          <h1 id="agents-heading">Agents</h1>
          <p>
            The specialists that can interpret this workspace&rsquo;s real
            findings, and the record of every real collaboration they&rsquo;ve
            run. Never shown to ordinary members — the daily command center only
            ever shows one reconciled recommendation, never this trace.
          </p>
        </div>
      </section>

      <div className="profileGrid">
        <section
          className="settingsCard"
          aria-labelledby="agent-fabric-heading"
        >
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">AI availability</p>
              <h2 id="agent-fabric-heading">AI investigation status</h2>
            </div>
            <span
              className={
                isAgentFabricEnabled() ? "readOnlyBadge" : "plannedBadge"
              }
            >
              {isAgentFabricEnabled() ? "Enabled" : "Disabled"}
            </span>
          </div>

          <dl className="settingsList">
            <div>
              <dt>AI investigations</dt>
              <dd>
                {isAgentFabricEnabled()
                  ? "On for this workspace"
                  : "Off — no investigation can run right now"}
              </dd>
            </div>
            <div>
              <dt>Premium AI model</dt>
              <dd>
                {isClaudeConfigured()
                  ? "Available"
                  : "Not available yet — investigations use SignalDesk's deterministic rules instead"}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="settingsCard"
          aria-labelledby="agent-directory-heading"
        >
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Registry</p>
              <h2 id="agent-directory-heading">Agent directory</h2>
            </div>
            <span className="readOnlyBadge">Real</span>
          </div>

          {AGENT_REGISTRY.map((agent) => (
            <dl className="settingsList" key={agent.id}>
              <div>
                <dt>{agent.displayName}</dt>
                <dd>
                  {availability.isAvailable(agent)
                    ? "Available"
                    : "Unavailable — no API key configured"}
                </dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{agent.provider}</dd>
              </div>
              <div>
                <dt>Capabilities</dt>
                <dd>{agent.capabilities.join(", ")}</dd>
              </div>
              <div>
                <dt>Risk level</dt>
                <dd>{agent.riskLevel}</dd>
              </div>
              <div>
                <dt>Can propose / execute</dt>
                <dd>
                  {agent.canPropose ? "Yes" : "No"} /{" "}
                  {agent.canExecute ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt>Time budget</dt>
                <dd>{agent.timeBudgetMs / 1000}s</dd>
              </div>
            </dl>
          ))}
        </section>

        <section
          className="settingsCard"
          aria-labelledby="collaboration-trace-heading"
        >
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Audit</p>
              <h2 id="collaboration-trace-heading">Collaboration trace</h2>
            </div>
            <span className="readOnlyBadge">Real</span>
          </div>

          {trace.length === 0 ? (
            <p>
              No investigations have run yet. Type &ldquo;investigate
              risk&rdquo; in the <Link href="/">command bar</Link> to run one.
            </p>
          ) : (
            trace.map(({ collaboration, results }) => (
              <div key={collaboration.id} className="settingsList">
                <dl className="settingsList">
                  <div>
                    <dt>Objective</dt>
                    <dd>{collaboration.objective}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{collaboration.status}</dd>
                  </div>
                  <div>
                    <dt>Collaboration pattern</dt>
                    <dd>{collaboration.pattern.replace(/_/g, " ")}</dd>
                  </div>
                  <div>
                    <dt>Contradictions detected</dt>
                    <dd>
                      {collaboration.contradictionsDetected ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div>
                    <dt>Reconciled confidence</dt>
                    <dd>
                      {formatConfidence(
                        collaboration.reconciledConfidenceBasisPoints,
                      )}
                    </dd>
                  </div>
                  {collaboration.reconciledSummary ? (
                    <div>
                      <dt>Reconciled summary</dt>
                      <dd>{collaboration.reconciledSummary}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Decision</dt>
                    <dd>
                      {collaboration.outcome === "approved"
                        ? `Approved · ${formatReviewedAt(collaboration.reviewedAt)}`
                        : collaboration.outcome === "dismissed"
                          ? `Dismissed · ${formatReviewedAt(collaboration.reviewedAt)}`
                          : "Awaiting review"}
                    </dd>
                  </div>
                </dl>

                {results.map((result) => (
                  <dl className="settingsList" key={result.id}>
                    <div>
                      <dt>Specialist</dt>
                      <dd>
                        {result.agentId} · {result.capability} · {result.status}
                        {result.confidenceBasisPoints !== null
                          ? ` · ${formatConfidence(result.confidenceBasisPoints)}`
                          : ""}
                      </dd>
                    </div>
                  </dl>
                ))}
              </div>
            ))
          )}
        </section>

        <section
          className="settingsCard"
          aria-labelledby="card-feedback-heading"
        >
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Evaluation</p>
              <h2 id="card-feedback-heading">Card feedback</h2>
            </div>
            <span className="readOnlyBadge">Real</span>
          </div>

          <p>
            Real &ldquo;Useful&rdquo;/&ldquo;Not relevant&rdquo; clicks from
            every member, grouped by card type. A real deterministic aggregate,
            not an AI quality score — there is no evaluation harness yet, only
            real counts.
          </p>

          {feedbackSummary.length === 0 ? (
            <p>No feedback has been recorded yet.</p>
          ) : (
            feedbackSummary.map((entry) => (
              <dl className="settingsList" key={entry.cardType}>
                <div>
                  <dt>{entry.cardType.replace(/_/g, " ")}</dt>
                  <dd>
                    {entry.usefulCount} useful · {entry.notRelevantCount} not
                    relevant
                    {entry.usefulRate !== null
                      ? ` · ${Math.round(entry.usefulRate * 100)}% useful`
                      : ""}
                  </dd>
                </div>
              </dl>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
