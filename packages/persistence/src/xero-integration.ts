import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface XeroIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
  /** The Xero `tenantId` — the `Xero-tenant-id` header every real
   * Accounting API call needs, not just an internal identifier. */
  readonly externalAccountId: string;
}

interface XeroIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
  readonly external_account_id: string;
}

function toRow(row: XeroIntegrationDbRow): XeroIntegrationRow {
  return {
    id: row.id,
    status: row.status,
    externalAccountLabel: row.external_account_label,
    externalAccountId: row.external_account_id,
  };
}

/**
 * Read-only lookup for the page rendering the connector's real status —
 * never creates a row. Mirrors `getQuickBooksIntegrationStatus`'s "prefer
 * an active row" logic exactly.
 */
export async function getXeroIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<XeroIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<XeroIntegrationDbRow>(
      `select id, status, external_account_label, external_account_id from integrations
       where organization_id = $1 and source_system = 'xero'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific Xero organisation,
 * identified by `tenantId` returned from the real post-token-exchange
 * `/connections` call (see `fetchXeroConnections`'s doc comment in
 * `@signaldesk/integrations/xero` — there is no `realmId`-in-redirect
 * shortcut here the way QuickBooks has). Unlike QuickBooks, Xero's
 * `/connections` response does carry a real human-readable
 * `tenantName`, so this connector can populate `external_account_label`
 * from day one, the same as Slack's/Salesforce's own connections.
 */
export async function findOrCreateXeroIntegration(
  pool: DatabasePool,
  organizationId: string,
  tenantId: string,
  tenantName: string,
): Promise<XeroIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<XeroIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, external_account_label, status)
       values ($1, $2, 'xero', $3, $4, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active', external_account_label = excluded.external_account_label
       returning id, status, external_account_label, external_account_id`,
      [randomUUID(), organizationId, tenantId, tenantName],
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
 * `disconnect_integration` (0019) every other connector's disconnect
 * uses.
 */
export async function disconnectXeroIntegration(
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
