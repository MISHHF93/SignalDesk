import { generateDailyBrief } from "@signaldesk/application";
import {
  createArtifact,
  createDatabasePool,
  listOrganizationsNeedingDailyBrief,
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
// stay comfortably under this for the foreseeable future. Real gap found
// by review: `listActiveOrganizationIds` (no ordering) used to back this
// slice, so once real org count exceeded this cap, the same arbitrary
// subset could be returned every run, permanently excluding the rest
// rather than just delaying them. `listOrganizationsNeedingDailyBrief`
// (migration 0065b) orders by least-recently-briefed first specifically
// so a run capped here always makes forward progress on the ones that
// need it most.
const MAX_ORGANIZATIONS_PER_RUN = 500;

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
 * (delivery is best-effort and can duplicate-invoke) — really, at the
 * database level now, not just in appearance. Real gap found by review:
 * this used to check "does a `daily_brief` artifact already exist for
 * today?" via a separate `listArtifacts` read, then unconditionally
 * insert — a non-atomic check-then-act that two overlapping invocations
 * for the same organization could both pass, each inserting a real
 * duplicate brief. `createArtifact` now takes a real
 * `idempotencyKey` (`daily-brief:{utcDate}`), enforced unique per
 * organization by the database itself (migration 0065) — an overlapping
 * invocation's insert is rejected by Postgres, not raced against in
 * application code.
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
  const now = new Date();
  const organizationIds = await listOrganizationsNeedingDailyBrief(
    db,
    MAX_ORGANIZATIONS_PER_RUN,
  );
  const utcDate = now.toISOString().slice(0, 10);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const organizationId of organizationIds) {
    try {
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

      const artifact = await createArtifact(db, organizationId, {
        type: "daily_brief",
        title: brief.title,
        content: brief.content,
        structuredData: { ...brief.structuredData },
        sourceFindingIds: brief.sourceFindingIds,
        idempotencyKey: `daily-brief:${utcDate}`,
      });

      if (artifact) {
        generated += 1;
      } else {
        // A real conflict: this organization already has today's brief,
        // created by an earlier or concurrently-overlapping invocation.
        skipped += 1;
      }
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
