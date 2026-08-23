import { generateDailyBrief } from "@signaldesk/application";
import {
  createArtifact,
  createDatabasePool,
  listActiveOrganizationIds,
  listArtifacts,
  type DatabasePool,
} from "@signaldesk/persistence";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { errorReporter } from "../../../_lib/error-reporter";
import type { CurrentSession } from "../../../_lib/session";
import { getTodaysAttention } from "../../../_lib/todays-attention";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

// A real, disclosed safety bound — see the connector-client `MAX_*_PAGES`
// stopgap convention this repo already uses elsewhere. Prevents one
// invocation from attempting an unbounded number of organizations (this
// dev environment alone has thousands of test-fixture rows) within
// Vercel's function duration limit; a real production org count should
// stay comfortably under this for the foreseeable future.
const MAX_ORGANIZATIONS_PER_RUN = 500;

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * The Morning Business Agent's real trigger (`PRODUCTION-ACTIVATION-
 * CHECKLIST.md` Stage 12) — a Vercel Cron target (see the `crons` entry
 * in `apps/web/vercel.json`), secured via Vercel's own documented
 * `CRON_SECRET` bearer-token convention. Read-only against every
 * connector, zero AI calls, zero external writes — `generateDailyBrief`
 * (`@signaldesk/application`) is the same deterministic, evidence-backed
 * generator `generateDailyBriefAction` (the user-triggered "Generate my
 * brief" button) already uses; this route is only new plumbing for
 * *when* it runs, not a second implementation of *what* it produces.
 *
 * Idempotent per Vercel's own explicit guidance for cron endpoints
 * (delivery is best-effort and can duplicate-invoke): skips an
 * organization that already has a `daily_brief` artifact generated
 * earlier the same UTC day, rather than creating a second one.
 *
 * One organization's failure is caught and reported individually — never
 * lets a single bad organization abort the whole run.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getPool();
  const organizationIds = (await listActiveOrganizationIds(db)).slice(
    0,
    MAX_ORGANIZATIONS_PER_RUN,
  );

  const now = new Date();
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const organizationId of organizationIds) {
    try {
      const existingBriefs = await listArtifacts(
        db,
        organizationId,
        "daily_brief",
      );
      const alreadyGeneratedToday = existingBriefs.some((artifact) =>
        isSameUtcDay(artifact.generatedAt, now),
      );

      if (alreadyGeneratedToday) {
        skipped += 1;
        continue;
      }

      // Only `organizationId` is real here — `getTodaysAttention` reads
      // nothing else off this object (confirmed directly by inspecting
      // every `session.*` reference in `todays-attention.ts` before
      // relying on that). There is no real signed-in user in a cron
      // invocation; these placeholder fields are never persisted as if
      // they belonged to one.
      const syntheticSession: CurrentSession = {
        organizationId,
        userId: "scheduled-job",
        role: "owner",
        email: null,
        isAnonymous: false,
      };

      const { findings } = await getTodaysAttention(syntheticSession, now);
      const brief = generateDailyBrief(findings, now);

      await createArtifact(db, organizationId, {
        type: "daily_brief",
        title: brief.title,
        content: brief.content,
        structuredData: { ...brief.structuredData },
        sourceFindingIds: brief.sourceFindingIds,
      });

      generated += 1;
    } catch (error) {
      failed += 1;
      errorReporter.captureException(error, {
        organizationId,
        operation: "cron.morning_brief",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    organizationsConsidered: organizationIds.length,
    generated,
    skipped,
    failed,
  });
}
