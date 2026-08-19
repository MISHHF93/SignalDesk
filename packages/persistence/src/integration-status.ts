import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Lists every `source_system` with an active integration row for this
 * organization — `source_system` values match connector catalog `slug`s
 * exactly (e.g. `'hubspot'`), so callers can pass this straight into
 * `IntelligenceContext.connectedIntegrationSlugs`.
 */
export async function listActiveIntegrationSourceSystems(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly string[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ source_system: string }>(
      `select distinct source_system from integrations
       where organization_id = $1 and status = 'active'`,
      [organizationId],
    );

    return result.rows.map((row) => row.source_system);
  });
}
