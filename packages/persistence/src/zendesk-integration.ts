import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface ZendeskIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
  /** The connected Zendesk account's own subdomain — every API call,
   * including "Sync Now" and revocation, targets
   * `https://{externalAccountId}.zendesk.com`. */
  readonly externalAccountId: string;
}

interface ZendeskIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
  readonly external_account_id: string;
}

function toRow(row: ZendeskIntegrationDbRow): ZendeskIntegrationRow {
  return {
    id: row.id,
    status: row.status,
    externalAccountLabel: row.external_account_label,
    externalAccountId: row.external_account_id,
  };
}

/**
 * Read-only lookup for the page rendering the connector's real status —
 * never creates a row. Mirrors `getJiraIntegrationStatus`'s "prefer an
 * active row" logic exactly.
 */
export async function getZendeskIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<ZendeskIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<ZendeskIntegrationDbRow>(
      `select id, status, external_account_label, external_account_id from integrations
       where organization_id = $1 and source_system = 'zendesk'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific Zendesk account,
 * identified by its own subdomain — unlike Salesforce/Xero/Jira, no
 * separate post-token-exchange discovery call is needed at all: the
 * subdomain is already known, real user input from the connect form (see
 * `connect-zendesk.ts`'s own doc comment), so `external_account_label`
 * can be populated from the subdomain itself from day one.
 */
export async function findOrCreateZendeskIntegration(
  pool: DatabasePool,
  organizationId: string,
  subdomain: string,
): Promise<ZendeskIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<ZendeskIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, external_account_label, status)
       values ($1, $2, 'zendesk', $3, $3, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active'
       returning id, status, external_account_label, external_account_id`,
      [randomUUID(), organizationId, subdomain],
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
 * uses. Unlike Jira, remote revocation is real here (see `client.ts`'s
 * top-of-file doc comment) — the actual revoke call happens in
 * `disconnect-zendesk.ts` before this runs, mirroring
 * `disconnectXeroAction`'s exact best-effort-then-local-cleanup order.
 */
export async function disconnectZendeskIntegration(
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
