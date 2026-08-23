import {
  createDatabasePool,
  getLatestArtifact,
  type DatabasePool,
} from "@signaldesk/persistence";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BusinessMetricsPanel } from "./_components/business-metrics-panel";
import { CommandCenterBoard } from "./_components/command-center-board";
import { DailyBriefPanel } from "./_components/daily-brief-panel";
import { GoalsPanel } from "./_components/goals-panel";
import { approveAgentActionProposalAction } from "./_actions/approve-agent-action-proposal";
import { createGoalAction } from "./_actions/create-goal";
import { createInternalTaskAction } from "./_actions/create-internal-task";
import { dismissAgentActionProposalAction } from "./_actions/dismiss-agent-action-proposal";
import { emailDailyBriefAction } from "./_actions/email-daily-brief";
import { generateDailyBriefAction } from "./_actions/generate-daily-brief";
import { generateSinceYouLeftBriefAction } from "./_actions/generate-since-you-left-brief";
import { parseCommandAction } from "./_actions/parse-command";
import { recordCardFeedbackAction } from "./_actions/record-card-feedback";
import { runAgentInvestigationAction } from "./_actions/run-agent-investigation";
import { simulateInvoicePaymentAction } from "./_actions/simulate-invoice-payment";
import { isAgentFabricEnabled } from "./_lib/agent-config";
import { getCurrentOrganization } from "./_lib/session";
import { getTodaysAttention } from "./_lib/todays-attention";

export const dynamic = "force-dynamic";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export const metadata: Metadata = {
  title: "Today",
};

function formatLongDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(date);
}

function formatClockTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

export default async function CommandCenterPage() {
  const session = await getCurrentOrganization();

  if (!session) {
    redirect("/login");
  }

  const now = new Date();
  const [
    {
      cards,
      deferredCount,
      connectedIntegrationSlugs,
      businessProfile,
      metrics,
      goals,
    },
    latestBrief,
  ] = await Promise.all([
    getTodaysAttention(session, now),
    getLatestArtifact(getPool(), session.organizationId, "daily_brief"),
  ]);

  return (
    <main className="shell dashboard" id="main-content">
      <section className="welcome" aria-labelledby="page-heading">
        <div>
          <p className="dateLine">
            <time dateTime={now.toISOString()}>
              {formatLongDate(now, businessProfile.timezone)}
            </time>
            <span aria-hidden="true">·</span>
            Today
          </p>
          <h1 id="page-heading">Here’s what needs your attention.</h1>
          <p className="welcomeCopy">
            {session.isAnonymous
              ? "You're browsing as a guest, in your own private workspace."
              : `Signed in as ${session.email}.`}{" "}
            {connectedIntegrationSlugs.length === 0 ? (
              <>
                No data sources are connected yet, so this reflects only what
                the platform itself already knows — see{" "}
                <Link href="/integrations">Integrations</Link> for what
                connecting one will unlock.
              </>
            ) : (
              `Reflecting data synced from ${connectedIntegrationSlugs.length} connected source${connectedIntegrationSlugs.length === 1 ? "" : "s"}.`
            )}
          </p>
        </div>
        <p className="renderTime">
          Snapshot rendered{" "}
          <time dateTime={now.toISOString()}>
            {formatClockTime(now, businessProfile.timezone)}
          </time>
        </p>
      </section>

      <BusinessMetricsPanel metrics={metrics} />

      <GoalsPanel
        goals={goals}
        metrics={metrics}
        createGoalAction={createGoalAction}
      />

      <section className="attentionSection" aria-labelledby="attention-heading">
        <div className="sectionHeading">
          <div>
            <p className="sectionKicker">Priority queue</p>
            <h2 id="attention-heading">Needs attention now</h2>
          </div>
          <p>
            {cards.length === 0
              ? "Nothing right now"
              : `${cards.length} item${cards.length === 1 ? "" : "s"}`}
            {deferredCount > 0 ? (
              <>
                {" · "}
                <span className="deferredCount">
                  {deferredCount} more lower-priority item
                  {deferredCount === 1 ? "" : "s"} not shown
                </span>
              </>
            ) : null}
          </p>
        </div>

        <CommandCenterBoard
          initialCards={cards}
          createTaskAction={createInternalTaskAction}
          parseCommandAction={parseCommandAction}
          runAgentInvestigationAction={runAgentInvestigationAction}
          aiInvestigationAvailable={isAgentFabricEnabled()}
          approveAgentActionProposalAction={approveAgentActionProposalAction}
          dismissAgentActionProposalAction={dismissAgentActionProposalAction}
          simulateInvoicePaymentAction={simulateInvoicePaymentAction}
          recordCardFeedbackAction={recordCardFeedbackAction}
        />
      </section>

      <DailyBriefPanel
        generateAction={generateDailyBriefAction}
        generateSinceYouLeftAction={generateSinceYouLeftBriefAction}
        emailAction={emailDailyBriefAction}
        canEmailBrief={!session.isAnonymous && Boolean(session.email)}
        initialArtifact={latestBrief}
      />
    </main>
  );
}
