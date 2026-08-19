import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createDatabasePool,
  listArtifacts,
  type DatabasePool,
} from "@business-dashboard/persistence";

import { getCurrentOrganization } from "../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export const metadata: Metadata = { title: "Daily Brief history" };

function formatGeneratedAt(generatedAt: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(generatedAt);
}

export default async function BriefsHistoryPage() {
  const session = await getCurrentOrganization();

  if (!session) {
    redirect("/login?next=/briefs");
  }

  const briefs = await listArtifacts(
    getPool(),
    session.organizationId,
    "daily_brief",
  );

  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="briefs-heading">
        <div>
          <p className="sectionKicker">Artifact</p>
          <h1 id="briefs-heading">Daily Brief history.</h1>
          <p>Every brief you&rsquo;ve generated, newest first.</p>
        </div>
        <Link className="btn btn-ghost" href="/">
          Back to today
        </Link>
      </section>

      {briefs.length === 0 ? (
        <aside
          className="honestyNotice"
          aria-labelledby="briefs-notice-heading"
        >
          <span className="noticeIcon" aria-hidden="true">
            ⚠
          </span>
          <div>
            <h2 id="briefs-notice-heading">No briefs yet</h2>
            <p>
              <Link href="/">Generate today&rsquo;s Daily Brief</Link> to start
              building history.
            </p>
          </div>
        </aside>
      ) : (
        <div className="dailyBriefHistoryList">
          {briefs.map((brief) => (
            <article key={brief.id} className="dailyBriefCard">
              <h3>{brief.title}</h3>
              <pre className="dailyBriefContent">{brief.content}</pre>
              <p className="dailyBriefMeta">
                Built from {brief.sourceFindingIds.length} real finding
                {brief.sourceFindingIds.length === 1 ? "" : "s"} — generated{" "}
                {formatGeneratedAt(brief.generatedAt)}.
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
