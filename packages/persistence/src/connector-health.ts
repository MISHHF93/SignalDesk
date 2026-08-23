import type { DatabasePool } from "./client";
import { listRecentSyncJobsForConnection } from "./sync-jobs";

export type ConnectorHealthStatus =
  "healthy" | "degraded" | "error" | "unknown";

export interface ConnectorHealth {
  readonly status: ConnectorHealthStatus;
  readonly lastSuccessfulSyncAt: Date | null;
  readonly lastAttemptedSyncAt: Date | null;
  readonly lastError: string | null;
  /** Minutes since the last successful sync completed, or `null` when
   * there has never been one — matches README's target "Integration
   * Reliability Engine" `dataFreshness` field. */
  readonly freshnessMinutes: number | null;
}

const RECENT_JOBS_TO_CONSIDER = 5;

/**
 * Derived, never persisted (ADR 0021) — reads a connection's most recent
 * `sync_jobs` rows and reduces them to one honest status:
 * - `"healthy"`: the latest job succeeded.
 * - `"degraded"`: the latest job failed but an earlier one succeeded —
 *   real data exists, it's just stale or the last refresh attempt failed.
 * - `"error"`: the latest job failed and none has ever succeeded.
 * - `"unknown"`: no job exists yet, or the latest is still `running`
 *   (nothing conclusive to report).
 */
export async function computeConnectorHealth(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  now: Date = new Date(),
): Promise<ConnectorHealth> {
  const recentJobs = await listRecentSyncJobsForConnection(
    pool,
    organizationId,
    integrationId,
    RECENT_JOBS_TO_CONSIDER,
  );
  const latest = recentJobs[0] ?? null;
  const lastSuccess =
    recentJobs.find((job) => job.status === "succeeded") ?? null;

  const status: ConnectorHealthStatus =
    !latest || latest.status === "running"
      ? "unknown"
      : latest.status === "succeeded"
        ? "healthy"
        : lastSuccess
          ? "degraded"
          : "error";

  const freshnessMinutes = lastSuccess?.completedAt
    ? Math.round((now.getTime() - lastSuccess.completedAt.getTime()) / 60_000)
    : null;

  return {
    status,
    lastSuccessfulSyncAt: lastSuccess?.completedAt ?? null,
    lastAttemptedSyncAt: latest?.startedAt ?? null,
    lastError: latest?.status === "failed" ? latest.errorMessage : null,
    freshnessMinutes,
  };
}
