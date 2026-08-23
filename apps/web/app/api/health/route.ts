import { createDatabasePool } from "@signaldesk/persistence";
import { NextResponse } from "next/server";

import { errorReporter } from "../../_lib/error-reporter";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * A real liveness+readiness probe for uptime monitors, load balancers, and
 * Vercel's own deployment health checks — deliberately distinct from
 * `/api/business/snapshot` (which is auth-gated and tenant-scoped, wrong
 * shape for an anonymous infrastructure check). No session required, no
 * tenant context, nothing rendered — just "is this instance able to reach
 * its database." A short query timeout means a slow DB shows up as
 * `degraded`, not a hung request blocking whatever's polling this.
 *
 * The real error is never returned in the response body: this route is
 * public and unauthenticated by design (that's the whole point of a
 * health check), and a raw `pg` connection/query error can carry
 * infrastructure detail (host, pooler behavior, driver-level messages)
 * that's fine for an operator to see in logs but not for any anonymous
 * caller to read off the endpoint — the same class of gap
 * `QueryFailedError`/`UpstreamProviderError` closed elsewhere, found
 * again here because this route intentionally bypasses
 * `withTenantContext` (a health check has no tenant) and so never passed
 * through that wrapping. Logged via `errorReporter` instead, same as
 * every other real error path in this app.
 */
export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();

  try {
    await Promise.race([
      getPool().query("select 1"),
      new Promise((_resolve, reject) =>
        setTimeout(
          () => reject(new Error("Health check query timed out")),
          3000,
        ),
      ),
    ]);
    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        durationMs: Date.now() - startedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    errorReporter.captureException(error, { operation: "api.health" });
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        durationMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
