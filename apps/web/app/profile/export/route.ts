import { NextResponse } from "next/server";

import {
  createDatabasePool,
  exportOrganizationData,
  type DatabasePool,
} from "@signaldesk/persistence";

import { checkRateLimit } from "../../_lib/rate-limit";
import { getRequestOrigin } from "../../_lib/request-origin";
import { getCurrentOrganization } from "../../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * A real file download needs response headers a Server Action can't set
 * (Content-Disposition) — a Route Handler, matching the convention every
 * other "real response outside ordinary page rendering" already follows
 * in this app (`billing/webhooks/stripe`, the OAuth callbacks). Unlike
 * those, this one is navigated to directly via a plain `<a href>` click
 * (`profile/page.tsx`), not fetched via JS, so an unhandled throw would
 * otherwise land the visitor on a bare, un-branded response with no way
 * back — wrapped in a try/catch that redirects to `/profile` with an
 * honest failure banner instead, matching how `/billing` already reports
 * its own action outcomes via a `?billing=` query param.
 *
 * Real gap found by review: this had no rate limit at all — a second,
 * previously-overlooked instance of the exact gap `business/snapshot/
 * route.ts`'s own doc comment once called "the one authenticated endpoint
 * with no bound on repeat calls" (already fixed there). `exportOrganizationData`
 * is a full multi-table dump (leads/invoices/tasks/messages/support
 * tickets/artifacts/audit events/subscription) — heavier than a single
 * snapshot read, so bounded more tightly: 5/hour, matching
 * `delete-organization.ts`'s own bound for a comparably heavy,
 * infrequent-by-design real operation. Keyed by organization, matching
 * every other post-authentication rate limit in this codebase.
 */
export async function GET() {
  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.json({ error: "Sign in to do this." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `profile-export:${session.organizationId}`,
    5,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  try {
    const data = await exportOrganizationData(
      getPool(),
      session.organizationId,
    );

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="signaldesk-export-${session.organizationId}.json"`,
      },
    });
  } catch {
    const origin = await getRequestOrigin();
    return NextResponse.redirect(`${origin}/profile?profile=export_failed`);
  }
}
