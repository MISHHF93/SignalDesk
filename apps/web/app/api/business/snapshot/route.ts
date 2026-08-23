import { NextResponse } from "next/server";

import { createDatabasePool, type DatabasePool } from "@signaldesk/persistence";

import { getBusinessSnapshot } from "../../../_lib/business-snapshot";
import { checkRateLimit } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * The first `app/api` route in this app — every other real write so far
 * has been a Server Action, and every other real read has been a Server
 * Component fetching directly. This exists for client-side consumers
 * (`useBusinessSnapshot`) that need to re-fetch the snapshot without a
 * full page reload; `page.tsx`'s own initial render calls
 * `getBusinessSnapshot` directly rather than round-tripping through this
 * route, since a Server Component calling its own API route over HTTP
 * would only add latency for no benefit.
 *
 * Rate-limited like every other real write/action in this app (a
 * disclosed, previously-unaddressed gap: this was the one authenticated
 * endpoint with no bound on repeat calls). `useBusinessSnapshot` has no
 * automatic polling — only a manual `refresh()` — so 30/minute is
 * generous for real usage while still bounding a scripted hammering of
 * the endpoint. Keyed by organization, matching every other
 * post-authentication rate limit in this codebase (session-scoped, not
 * the weaker IP-based key reserved for pre-auth endpoints).
 */
export async function GET() {
  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.json({ error: "Sign in to do this." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `business-snapshot:${session.organizationId}`,
    30,
    60 * 1000,
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

  const snapshot = await getBusinessSnapshot(session, new Date());

  return NextResponse.json(snapshot);
}
