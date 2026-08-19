import type { PoolClient } from "pg";

import type { DatabasePool } from "./client";

const ORGANIZATION_ID_FORMAT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs `fn` inside a transaction with `app.current_organization_id` set via
 * `set_config(..., true)`, which PostgreSQL scopes to the current transaction
 * only (reset on COMMIT/ROLLBACK). This is the sole sanctioned way to touch
 * tenant-owned tables: RLS policies key off this setting, and it must never
 * be set outside a transaction or shared across pooled connections.
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
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
