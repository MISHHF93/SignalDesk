import type { DatabasePool } from "./client";

/**
 * Runs `fn` while holding a real, cross-instance Postgres advisory lock
 * keyed by an arbitrary string (hashed via `hashtext`) — the right
 * primitive for a critical section that spans an external API call (e.g.
 * Stripe) and therefore can't be a single database write, where
 * `withTenantContext` doesn't apply on its own.
 *
 * Transaction-scoped (`pg_try_advisory_xact_lock`, not the session-level
 * `pg_advisory_lock`/`pg_advisory_unlock` pair), held on one dedicated
 * connection via an explicit `begin`/`commit` — same shape as
 * `withTenantContext`. This is not optional here: `DATABASE_URL` points
 * at Supabase's transaction-mode pooler (port 6543), which reassigns the
 * underlying physical backend connection between un-transacted
 * statements, so a session-level lock acquired by one statement can be
 * silently invisible to the "same" client's next statement — confirmed by
 * a live-database test that failed against the session-level version
 * before this was caught. Wrapping the whole critical section in one
 * transaction pins it to one real backend for as long as `fn` runs,
 * however long that is (a real Stripe call included), and
 * `pg_try_advisory_xact_lock`'s lock auto-releases on commit/rollback —
 * no risk of a stuck lock if the process crashes mid-`fn`, unlike the
 * session-level pair, which would need an explicit unlock that might
 * never run.
 *
 * Non-blocking: returns `null` immediately if another caller already
 * holds the same key, rather than queuing behind it, matching the
 * fast-reject UX a Server Action needs (never leave a request hanging on
 * a lock another request might hold for a while).
 *
 * First real caller: `start-checkout.ts`'s double-submit guard, replacing
 * an in-memory `Set` that was single-process-only and stopped protecting
 * against a real race — creating two live, billed Stripe subscriptions
 * for one organization — the moment this app runs as more than one
 * server instance.
 */
export async function withAdvisoryLock<T>(
  pool: DatabasePool,
  key: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const lockResult = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_xact_lock(hashtext($1)::bigint) as locked",
      [key],
    );

    if (!lockResult.rows[0]?.locked) {
      await client.query("rollback");
      return null;
    }

    try {
      const result = await fn();
      await client.query("commit");
      return result;
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        // Same reasoning as withTenantContext's identical guard
        // (tenant-context.ts): a rollback failure here (most likely a
        // dead connection) must never replace the real error from `fn` —
        // often a real external Stripe call — with a less actionable one.
      }
      throw error;
    }
  } finally {
    client.release();
  }
}
