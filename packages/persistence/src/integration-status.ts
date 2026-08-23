import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Lists every `source_system` with an active-or-degraded integration row
 * for this organization — `source_system` values match connector catalog
 * `slug`s exactly (e.g. `'hubspot'`), so callers can pass this straight
 * into `IntelligenceContext.connectedIntegrationSlugs`. `degraded` (ADR
 * 0043: a recent sync couldn't parse some records) still counts as
 * connected here — the connection is real and live, only some records
 * failed to validate; excluding it would make a genuinely-connected
 * capability class falsely read as "not connected."
 */
export async function listActiveIntegrationSourceSystems(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly string[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ source_system: string }>(
      `select distinct source_system from integrations
       where organization_id = $1 and status in ('active', 'degraded')`,
      [organizationId],
    );

    return result.rows.map((row) => row.source_system);
  });
}

export interface ActiveIntegration {
  readonly id: string;
  readonly sourceSystem: string;
}

/**
 * Every active-or-degraded integration's id and source system — unlike
 * `listActiveIntegrationSourceSystems` (distinct slugs only), this is what
 * a caller needs to actually act on each connection (e.g. disconnecting
 * every one of an organization's integrations as part of account
 * deletion, see `deleteOrganizationAction`) — a `degraded` connection
 * still holds a real Vault-stored credential that must be revoked too.
 */
export async function listActiveIntegrations(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly ActiveIntegration[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ id: string; source_system: string }>(
      `select id, source_system from integrations
       where organization_id = $1 and status in ('active', 'degraded')`,
      [organizationId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      sourceSystem: row.source_system,
    }));
  });
}
