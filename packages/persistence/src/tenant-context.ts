import type { PoolClient } from "pg";

import type { DatabasePool } from "./client";
import { wrapDatabaseError } from "./query-error";

const ORGANIZATION_ID_FORMAT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs `fn` inside a transaction with `app.current_organization_id` set via
 * `set_config(..., true)`, which PostgreSQL scopes to the current transaction
 * only (reset on COMMIT/ROLLBACK). This is the sole sanctioned way to touch
 * tenant-owned tables: RLS policies key off this setting, and it must never
 * be set outside a transaction or shared across pooled connections.
 *
 * A caught `pg` `DatabaseError` is wrapped into `QueryFailedError`
 * (`query-error.ts`) before rethrowing — the raw driver error can carry the
 * literal conflicting value in its own message on a constraint violation,
 * and every Server Action's catch block already returns a plain
 * `Error.message` verbatim to the client. A hand-thrown `Error` from
 * application code inside `fn` passes through unchanged.
 */
export async function withTenantContext<T>(
  pool: DatabasePool,
  organizationId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!ORGANIZATION_ID_FORMAT.test(organizationId)) {
    throw new Error(
      `organizationId must be a UUID, received: ${organizationId}`,
    );
  }

  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      "select set_config('app.current_organization_id', $1, true)",
      [organizationId],
    );

    const result = await fn(client);

    await client.query("commit");

    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // The rollback itself failing (most likely because the connection
      // is already dead — e.g. the original error was a lost connection)
      // must never replace `error` below: Postgres never partially
      // commits a transaction whose connection died first, so the
      // original error is still the real, actionable cause — a caller
      // debugging "rollback failed: connection terminated" instead of
      // the real underlying failure would be chasing the wrong thing.
    }
    throw wrapDatabaseError(error);
  } finally {
    client.release();
  }
}
