import { createDatabasePool } from "@signaldesk/persistence";
import { NextResponse } from "next/server";

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
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
