import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface MicrosoftCalendarIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
}

interface MicrosoftCalendarIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
}

function toRow(
  row: MicrosoftCalendarIntegrationDbRow,
): MicrosoftCalendarIntegrationRow {
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
export async function getMicrosoftCalendarIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<MicrosoftCalendarIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<MicrosoftCalendarIntegrationDbRow>(
      `select id, status, external_account_label from integrations
       where organization_id = $1 and source_system = 'microsoft-calendar'
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
 * identified by `microsoftUserId`. A genuinely separate OAuth grant from
 * Outlook's even for the same Microsoft account and even though both share
 * one Entra app registration — matches Gmail/Google Calendar's own
 * precedent. Same atomic-upsert pattern as
 * `findOrCreateMicrosoftOutlookIntegration`.
 */
export async function findOrCreateMicrosoftCalendarIntegration(
  pool: DatabasePool,
  organizationId: string,
  microsoftUserId: string,
  email: string | null,
): Promise<MicrosoftCalendarIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<MicrosoftCalendarIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, external_account_label, status)
       values ($1, $2, 'microsoft-calendar', $3, $4, 'active')
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
 * tokens — local-only, same reasoning as
 * `disconnectMicrosoftOutlookIntegration`. Calls the same provider-neutral
 * `disconnect_integration` (0019).
 */
export async function disconnectMicrosoftCalendarIntegration(
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
