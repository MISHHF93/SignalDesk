import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface SlackIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
}

interface SlackIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
}

function toRow(row: SlackIntegrationDbRow): SlackIntegrationRow {
  return {
    id: row.id,
    status: row.status,
    externalAccountLabel: row.external_account_label,
  };
}

/**
 * Read-only lookup for the page rendering the connector's real status —
 * never creates a row (unlike findOrCreateSlackIntegration, which the
 * OAuth callback alone should call). Mirrors
 * `getHubSpotIntegrationStatus`'s "prefer an active row" logic exactly —
 * see that function's doc comment for why a plain `created_at desc` isn't
 * enough once an organization has connected more than one workspace.
 */
export async function getSlackIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<SlackIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<SlackIntegrationDbRow>(
      `select id, status, external_account_label from integrations
       where organization_id = $1 and source_system = 'slack'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific Slack workspace,
 * identified by `teamId` returned from the real OAuth token exchange.
 * Same atomic-upsert pattern as `findOrCreateHubSpotIntegration` (race-safe
 * against a double-click or two tabs) — unlike HubSpot, Slack's token
 * exchange does return a human-readable workspace name, so this connector
 * can populate `external_account_label` from day one.
 */
export async function findOrCreateSlackIntegration(
  pool: DatabasePool,
  organizationId: string,
  teamId: string,
  teamName: string,
): Promise<SlackIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<SlackIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, external_account_label, status)
       values ($1, $2, 'slack', $3, $4, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active', external_account_label = excluded.external_account_label
       returning id, status, external_account_label`,
      [randomUUID(), organizationId, teamId, teamName],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("integrations upsert returned no row");
    }

    return toRow(row);
  });
}

/**
 * Real disconnect: deletes the Vault-stored token and marks the
 * integration `disconnected`, in one tenant-scoped transaction. Calls the
 * same provider-neutral `disconnect_integration` (0019) HubSpot's
 * disconnect uses.
 */
export async function disconnectSlackIntegration(
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
