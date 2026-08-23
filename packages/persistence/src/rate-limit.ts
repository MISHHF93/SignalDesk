import type { DatabasePool } from "./client";

/**
 * Real, shared, cross-instance rate limiting backed by
 * `rate_limit_buckets` (drizzle/0045_rate_limit_buckets.sql) — replaces
 * the in-memory `Map` `apps/web/app/_lib/rate-limit.ts` used to hold
 * directly, which the module's own doc comment already disclosed as
 * single-process-only. Called via plain `pool.query`, deliberately not
 * `withTenantContext` — same reasoning as `identity.ts`'s two functions:
 * several real call sites (sign-in, sign-up, guest access) have no tenant
 * context yet, since they run before authentication.
 *
 * The single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` below is the
 * entire implementation and is atomic under concurrent callers by
 * Postgres's own upsert guarantees — no separate read-then-write race is
 * possible, unlike the in-memory version's implicit single-process
 * assumption.
 */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export async function checkRateLimit(
  pool: DatabasePool,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const result = await pool.query<{ count: number; window_start: Date }>(
    `insert into public.rate_limit_buckets (key, count, window_start)
     values ($1, 1, now())
     on conflict (key) do update
     set
       count = case
         when public.rate_limit_buckets.window_start <= now() - ($2::text || ' milliseconds')::interval
         then 1
         else public.rate_limit_buckets.count + 1
       end,
       window_start = case
         when public.rate_limit_buckets.window_start <= now() - ($2::text || ' milliseconds')::interval
         then now()
         else public.rate_limit_buckets.window_start
       end
     returning count, window_start`,
    [key, windowMs],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("rate_limit_buckets upsert returned no row");
  }

  if (row.count <= limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const windowEndsAt = row.window_start.getTime() + windowMs;

  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      0,
      Math.ceil((windowEndsAt - Date.now()) / 1000),
    ),
  };
}
