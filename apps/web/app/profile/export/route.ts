import { NextResponse } from "next/server";

import {
  createDatabasePool,
  exportOrganizationData,
  type DatabasePool,
} from "@signaldesk/persistence";

import { getCurrentOrganization } from "../../_lib/session";
import { getRequestOrigin } from "../../_lib/request-origin";

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
 */
export async function GET() {
  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.json({ error: "Sign in to do this." }, { status: 401 });
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
