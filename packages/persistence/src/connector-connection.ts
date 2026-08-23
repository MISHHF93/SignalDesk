import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Formalizes what `integrations.token_vault_secret_id` already means
 * honestly: a connection either has an active Vault-stored credential, or
 * it doesn't (disconnected, or a provider like Slack whose token never
 * expires and is stored the same way). No other credential kind exists in
 * this app today — everything goes through Supabase Vault via
 * `store_integration_tokens`/`get_integration_tokens` (migration 0019).
 */
export type CredentialReference =
  | { readonly kind: "vault_secret"; readonly vaultSecretId: string }
  | { readonly kind: "none" };

export type ConnectorConnectionStatus =
  "pending" | "active" | "degraded" | "disconnected" | "revoked";

export interface ConnectorConnection {
  readonly id: string;
  readonly organizationId: string;
  readonly sourceSystem: string;
  readonly externalAccountId: string;
  readonly externalAccountLabel: string | null;
  readonly status: ConnectorConnectionStatus;
  readonly credential: CredentialReference;
  readonly enabledCapabilityIds: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface ConnectorConnectionRow {
  readonly id: string;
  readonly organization_id: string;
  readonly source_system: string;
  readonly external_account_id: string;
  readonly external_account_label: string | null;
  readonly status: string;
  readonly token_vault_secret_id: string | null;
  readonly enabled_capability_ids: readonly string[];
  readonly created_at: Date;
  readonly updated_at: Date;
}

const CONNECTOR_CONNECTION_COLUMNS =
  "id, organization_id, source_system, external_account_id, external_account_label, status, token_vault_secret_id, enabled_capability_ids, created_at, updated_at";

export function toConnectorConnection(
  row: ConnectorConnectionRow,
): ConnectorConnection {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceSystem: row.source_system,
    externalAccountId: row.external_account_id,
    externalAccountLabel: row.external_account_label,
    status: row.status as ConnectorConnectionStatus,
    credential: row.token_vault_secret_id
      ? { kind: "vault_secret", vaultSecretId: row.token_vault_secret_id }
      : { kind: "none" },
    enabledCapabilityIds: row.enabled_capability_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * A general-purpose, fully-typed reader over the real `integrations` table
 * — proves `ConnectorConnection`/`CredentialReference` against a real
 * query. Additive: does not replace any of the 9 per-connector
 * `getXIntegrationStatus` functions, which keep their own narrower return
 * shapes unchanged.
 *
 * No production caller today — the Trust Center (ADR 0047), the one real
 * page this would naturally back, calls its sibling
 * `listConnectorConnections` instead (it needs every connection, not
 * one). Kept real and tested (not deleted) as the natural single-record
 * counterpart once a real single-connector detail read is needed
 * somewhere other than the per-connector `getXIntegrationStatus`
 * functions — found unwired in a dead-code audit this session and
 * disclosed here rather than left undocumented.
 */
export async function getConnectorConnection(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<ConnectorConnection | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<ConnectorConnectionRow>(
      `select ${CONNECTOR_CONNECTION_COLUMNS} from integrations
       where organization_id = $1 and id = $2`,
      [organizationId, integrationId],
    );
    const row = result.rows[0];

    return row ? toConnectorConnection(row) : null;
  });
}

/**
 * Every real, currently-connected integration (`active` or `degraded` —
 * the same "still a live connection" definition ADR 0043 established;
 * `disconnected`/`revoked` are excluded), newest first — the real read
 * behind the Trust Center's "connected systems" section (Prompt 38,
 * docs/product-vision-backlog.md, ADR 0047). Unlike
 * `listActiveIntegrationSourceSystems`/`listActiveIntegrations`
 * (`integration-status.ts`, distinct slugs or id+system only), this
 * returns the full real row a trust-disclosure surface needs: status,
 * external account label, and when the connection was actually made.
 */
export async function listConnectorConnections(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly ConnectorConnection[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<ConnectorConnectionRow>(
      `select ${CONNECTOR_CONNECTION_COLUMNS} from integrations
       where organization_id = $1 and status in ('active', 'degraded')
       order by created_at desc`,
      [organizationId],
    );

    return result.rows.map(toConnectorConnection);
  });
}
