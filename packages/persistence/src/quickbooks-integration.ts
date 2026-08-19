import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface QuickBooksIntegrationRow {
  readonly id: string;
  readonly status: string;
  /** Always `null` for QuickBooks today — the token exchange response
   * carries no company name; that would require an extra CompanyInfo API
   * call this v1 doesn't make, matching HubSpot's own honest gap. */
  readonly externalAccountLabel: string | null;
}

interface QuickBooksIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
}

function toRow(row: QuickBooksIntegrationDbRow): QuickBooksIntegrationRow {
  return {
    id: row.id,
    status: row.status,
    externalAccountLabel: row.external_account_label,
  };
}

/**
 * Read-only lookup for the page rendering the connector's real status —
 * never creates a row. Mirrors `getHubSpotIntegrationStatus`'s "prefer an
 * active row" logic exactly.
 */
export async function getQuickBooksIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<QuickBooksIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<QuickBooksIntegrationDbRow>(
      `select id, status, external_account_label from integrations
       where organization_id = $1 and source_system = 'quickbooks'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific QuickBooks company,
 * identified by `realmId` — read directly off the OAuth callback's redirect
 * query string, not the token response (see client.ts's doc comment on
 * why). Same atomic-upsert pattern as `findOrCreateHubSpotIntegration`.
 */
export async function findOrCreateQuickBooksIntegration(
  pool: DatabasePool,
  organizationId: string,
  realmId: string,
): Promise<QuickBooksIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<QuickBooksIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, status)
       values ($1, $2, 'quickbooks', $3, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active'
       returning id, status, external_account_label`,
      [randomUUID(), organizationId, realmId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("integrations upsert returned no row");
    }

    return toRow(row);
  });
}

/**
 * Real disconnect: deletes the Vault-stored tokens and marks the
 * integration `disconnected`. Calls the same provider-neutral
 * `disconnect_integration` (0019) HubSpot's disconnect uses.
 */
export async function disconnectQuickBooksIntegration(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<void> {
  await withTenantContext(pool, organizationId, async (client) => {
    await client.query("select public.disconnect_integration($1)", [
      integrationId,
    ]);
  });
}
