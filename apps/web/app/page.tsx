import {
  createDatabasePool,
  getLatestArtifact,
  type DatabasePool,
} from "@business-dashboard/persistence";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CommandCenterBoard } from "./_components/command-center-board";
import { DailyBriefPanel } from "./_components/daily-brief-panel";
import { createInternalTaskAction } from "./_actions/create-internal-task";
import { generateDailyBriefAction } from "./_actions/generate-daily-brief";
import { parseCommandAction } from "./_actions/parse-command";
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
  const [{ cards, connectedIntegrationSlugs, businessProfile }, latestBrief] =
    await Promise.all([
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

      <section className="attentionSection" aria-labelledby="attention-heading">
        <div className="sectionHeading">
          <div>
            <p className="sectionKicker">Priority queue</p>
            <h2 id="attention-heading">Needs attention now</h2>
          </div>
          <p>
            {cards.length === 0
              ? "No dynamic cards"
              : `${cards.length} dynamic card${cards.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <CommandCenterBoard
          initialCards={cards}
          createTaskAction={createInternalTaskAction}
          parseCommandAction={parseCommandAction}
        />
      </section>

      <DailyBriefPanel
        generateAction={generateDailyBriefAction}
        initialArtifact={latestBrief}
      />
    </main>
  );
}
