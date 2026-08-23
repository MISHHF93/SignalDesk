import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface JiraIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
  /** The Jira `cloudId` the issue sync/"Sync Now" queries by. */
  readonly externalAccountId: string;
}

interface JiraIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
  readonly external_account_id: string;
}

function toRow(row: JiraIntegrationDbRow): JiraIntegrationRow {
  return {
    id: row.id,
    status: row.status,
    externalAccountLabel: row.external_account_label,
    externalAccountId: row.external_account_id,
  };
}

/**
 * Read-only lookup for the page rendering the connector's real status —
 * never creates a row. Mirrors `getAsanaIntegrationStatus`'s "prefer an
 * active row" logic exactly.
 */
export async function getJiraIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<JiraIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<JiraIntegrationDbRow>(
      `select id, status, external_account_label, external_account_id from integrations
       where organization_id = $1 and source_system = 'jira'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific Jira site,
 * identified by `cloudId` returned from the real post-token-exchange
 * `/accessible-resources` call (see `fetchJiraAccessibleResources`'s doc
 * comment in `@signaldesk/integrations/jira` — there is no `realmId`-in-
 * redirect shortcut here, the same real gap Xero has). The
 * `/accessible-resources` response does carry a real human-readable site
 * `name`, so this connector can populate `external_account_label` from
 * day one, the same as Xero's/Slack's own connections.
 */
export async function findOrCreateJiraIntegration(
  pool: DatabasePool,
  organizationId: string,
  cloudId: string,
  siteName: string,
): Promise<JiraIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<JiraIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, external_account_label, status)
       values ($1, $2, 'jira', $3, $4, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active', external_account_label = excluded.external_account_label
       returning id, status, external_account_label, external_account_id`,
      [randomUUID(), organizationId, cloudId, siteName],
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
 * uses — note this only deletes the *local* copy: Atlassian has no
 * programmatic revoke endpoint at all (see `client.ts`'s top-of-file doc
 * comment), so unlike every other connector here, disconnecting genuinely
 * cannot also revoke the grant on Atlassian's side; only the user can, via
 * their Atlassian account settings.
 */
export async function disconnectJiraIntegration(
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
