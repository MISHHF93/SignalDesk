import { NextResponse } from "next/server";

import {
  createDatabasePool,
  exportOrganizationData,
  type DatabasePool,
} from "@signaldesk/persistence";

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
 * in this app (`billing/webhooks/stripe`, the OAuth callbacks).
 */
export async function GET() {
  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.json({ error: "Sign in to do this." }, { status: 401 });
  }

  const data = await exportOrganizationData(getPool(), session.organizationId);

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="signaldesk-export-${session.organizationId}.json"`,
    },
  });
}
