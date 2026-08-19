import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface LinearIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
}

interface LinearIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
}

function toRow(row: LinearIntegrationDbRow): LinearIntegrationRow {
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
export async function getLinearIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<LinearIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<LinearIntegrationDbRow>(
      `select id, status, external_account_label from integrations
       where organization_id = $1 and source_system = 'linear'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific Linear user,
 * identified by `linearUserId` — resolved via a real GraphQL `viewer`
 * query right after the token exchange, since Linear's token response
 * carries no identifier at all (see `linear/client.ts`'s doc comment on
 * `fetchLinearViewer`). Same atomic-upsert pattern as
 * `findOrCreateHubSpotIntegration`.
 */
export async function findOrCreateLinearIntegration(
  pool: DatabasePool,
  organizationId: string,
  linearUserId: string,
  email: string | null,
): Promise<LinearIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<LinearIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, external_account_label, status)
       values ($1, $2, 'linear', $3, $4, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active', external_account_label = excluded.external_account_label
       returning id, status, external_account_label`,
      [randomUUID(), organizationId, linearUserId, email],
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
export async function disconnectLinearIntegration(
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
