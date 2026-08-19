import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface GoogleCalendarIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
}

interface GoogleCalendarIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
}

function toRow(
  row: GoogleCalendarIntegrationDbRow,
): GoogleCalendarIntegrationRow {
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
export async function getGoogleCalendarIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<GoogleCalendarIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<GoogleCalendarIntegrationDbRow>(
      `select id, status, external_account_label from integrations
       where organization_id = $1 and source_system = 'google-calendar'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific Google account,
 * identified by `googleUserId` (the id_token's `sub` claim). This is a
 * genuinely separate OAuth grant from Gmail's, even for the same Google
 * account and even though both share `packages/integrations/src/shared/
 * google-oauth.ts`'s mechanics — each catalog connector keeps its own
 * scope, its own consent, and its own `integrations` row, matching how
 * every other pair of connectors here (e.g. Slack vs. HubSpot) never
 * shares a grant. Same atomic-upsert pattern as `findOrCreateGmailIntegration`.
 */
export async function findOrCreateGoogleCalendarIntegration(
  pool: DatabasePool,
  organizationId: string,
  googleUserId: string,
  email: string | null,
): Promise<GoogleCalendarIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<GoogleCalendarIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, external_account_label, status)
       values ($1, $2, 'google-calendar', $3, $4, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active', external_account_label = excluded.external_account_label
       returning id, status, external_account_label`,
      [randomUUID(), organizationId, googleUserId, email],
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
export async function disconnectGoogleCalendarIntegration(
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
