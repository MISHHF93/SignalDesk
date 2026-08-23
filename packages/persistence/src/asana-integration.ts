import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface AsanaIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
  /** The Asana user gid the task sync/"Sync Now" queries by. */
  readonly externalAccountId: string;
}

interface AsanaIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
  readonly external_account_id: string;
}

function toRow(row: AsanaIntegrationDbRow): AsanaIntegrationRow {
  return {
    id: row.id,
    status: row.status,
    externalAccountLabel: row.external_account_label,
    externalAccountId: row.external_account_id,
  };
}

/**
 * Read-only lookup for the page rendering the connector's real status —
 * never creates a row. Mirrors `getHubSpotIntegrationStatus`'s "prefer an
 * active row" logic exactly.
 */
export async function getAsanaIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<AsanaIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<AsanaIntegrationDbRow>(
      `select id, status, external_account_label, external_account_id from integrations
       where organization_id = $1 and source_system = 'asana'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific Asana user,
 * identified by `asanaUserId` (the token response's `data.gid` — see
 * `packages/integrations/src/asana/client.ts`'s doc comment). Same atomic
 * upsert pattern as `findOrCreateHubSpotIntegration`.
 */
export async function findOrCreateAsanaIntegration(
  pool: DatabasePool,
  organizationId: string,
  asanaUserId: string,
  email: string | null,
): Promise<AsanaIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<AsanaIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, external_account_label, status)
       values ($1, $2, 'asana', $3, $4, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active', external_account_label = excluded.external_account_label
       returning id, status, external_account_label, external_account_id`,
      [randomUUID(), organizationId, asanaUserId, email],
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
export async function disconnectAsanaIntegration(
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
