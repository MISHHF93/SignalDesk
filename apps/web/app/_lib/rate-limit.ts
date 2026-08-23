import { headers } from "next/headers";

/**
 * Real, Postgres-backed, cross-instance rate limiting
 * (`@signaldesk/persistence`'s `checkRateLimit`, backed by
 * `rate_limit_buckets` — drizzle/0045_rate_limit_buckets.sql). Re-exported
 * from this same path so every existing call site keeps its import
 * unchanged; only the signature changed (now async, now takes a pool).
 * Previously an in-memory `Map`, explicitly documented as single-process-
 * only and silently ineffective across multiple server instances — closed
 * as Phase 0 of the implementation roadmap once a real deployment target
 * (multiple instances, not a single long-running process) was chosen.
 */
export { checkRateLimit, type RateLimitResult } from "@signaldesk/persistence";

/**
 * Best-effort client IP from the standard proxy headers most hosting
 * platforms set. Falls back to a shared bucket key when absent (e.g. local
 * dev without a proxy in front) — that's strictly weaker than per-IP
 * limiting, not a security guarantee; unrelated to `checkRateLimit`'s own
 * storage, which is real (see above).
 */
export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }

  return requestHeaders.get("x-real-ip") ?? "unknown";
}
