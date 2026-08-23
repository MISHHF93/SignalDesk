import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface SalesforceIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
  /** The org's real `instance_url` — every Salesforce org lives on its own
   * API host, so revoking a token (unlike HubSpot/Slack, both single-host
   * providers) needs this, not a fixed endpoint. See `revokeSalesforce
   * RefreshToken`'s doc comment in `@signaldesk/integrations/salesforce`. */
  readonly externalAccountId: string;
}

interface SalesforceIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
  readonly external_account_id: string;
}

function toRow(row: SalesforceIntegrationDbRow): SalesforceIntegrationRow {
  return {
    id: row.id,
    status: row.status,
    externalAccountLabel: row.external_account_label,
    externalAccountId: row.external_account_id,
  };
}

/**
 * Read-only lookup for the page rendering the connector's real status —
 * never creates a row (unlike findOrCreateSalesforceIntegration, which the
 * OAuth callback alone should call). Mirrors `getHubSpotIntegrationStatus`'s
 * "prefer an active row" logic exactly — see that function's doc comment
 * for why a plain `created_at desc` isn't enough once an organization has
 * connected more than one Salesforce org.
 */
export async function getSalesforceIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<SalesforceIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<SalesforceIntegrationDbRow>(
      `select id, status, external_account_label, external_account_id from integrations
       where organization_id = $1 and source_system = 'salesforce'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific Salesforce org,
 * identified by `instanceUrl` returned from the real OAuth token exchange
 * (the one stable per-org identifier Salesforce's token response actually
 * provides — see `SalesforceTokenResponse`'s doc comment in
 * `@signaldesk/integrations/salesforce`). Same atomic-upsert pattern as
 * `findOrCreateHubSpotIntegration`/`findOrCreateSlackIntegration` (race-safe
 * against a double-click or two tabs). `accountLabel` is the org's own
 * hostname (e.g. `mycompany.my.salesforce.com`), derived by the caller from
 * `instanceUrl` — human-readable, unlike HubSpot's `hubId`.
 */
export async function findOrCreateSalesforceIntegration(
  pool: DatabasePool,
  organizationId: string,
  instanceUrl: string,
  accountLabel: string,
): Promise<SalesforceIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<SalesforceIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, external_account_label, status)
       values ($1, $2, 'salesforce', $3, $4, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active', external_account_label = excluded.external_account_label
       returning id, status, external_account_label, external_account_id`,
      [randomUUID(), organizationId, instanceUrl, accountLabel],
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
 * integration `disconnected`, in one tenant-scoped transaction. Calls the
 * same provider-neutral `disconnect_integration` (0019) HubSpot's and
 * Slack's disconnect use.
 */
export async function disconnectSalesforceIntegration(
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
