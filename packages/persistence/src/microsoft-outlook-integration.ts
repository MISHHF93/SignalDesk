import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface MicrosoftOutlookIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
}

interface MicrosoftOutlookIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
}

function toRow(
  row: MicrosoftOutlookIntegrationDbRow,
): MicrosoftOutlookIntegrationRow {
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
export async function getMicrosoftOutlookIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<MicrosoftOutlookIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<MicrosoftOutlookIntegrationDbRow>(
      `select id, status, external_account_label from integrations
       where organization_id = $1 and source_system = 'microsoft-outlook'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific Microsoft account,
 * identified by `microsoftUserId` (the id_token's `oid`/`sub` claim — see
 * `packages/integrations/src/shared/microsoft-oauth.ts`'s doc comment).
 * Same atomic-upsert pattern as `findOrCreateGmailIntegration`.
 */
export async function findOrCreateMicrosoftOutlookIntegration(
  pool: DatabasePool,
  organizationId: string,
  microsoftUserId: string,
  email: string | null,
): Promise<MicrosoftOutlookIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<MicrosoftOutlookIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, external_account_label, status)
       values ($1, $2, 'microsoft-outlook', $3, $4, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active', external_account_label = excluded.external_account_label
       returning id, status, external_account_label`,
      [randomUUID(), organizationId, microsoftUserId, email],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("integrations upsert returned no row");
    }

    return toRow(row);
  });
}

/**
 * Marks the integration `disconnected` and deletes the Vault-stored
 * tokens — this is the *only* real revocation for Outlook: Microsoft has
 * no documented third-party single-token revoke endpoint (see
 * `microsoft-oauth.ts`'s doc comment), so unlike HubSpot/Slack/Gmail there
 * is no remote call for the disconnect Server Action to attempt before
 * this. Calls the same provider-neutral `disconnect_integration` (0019).
 */
export async function disconnectMicrosoftOutlookIntegration(
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
