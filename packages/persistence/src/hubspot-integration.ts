import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface HubSpotIntegrationRow {
  readonly id: string;
  readonly status: string;
  /** Always `null` for HubSpot today — its token exchange response
   * doesn't return a human-readable account/portal name the way Slack's
   * does. Present so callers that handle multiple OAuth connectors
   * generically (e.g. the connector detail page) see the same shape from
   * every provider, rather than special-casing which ones have it. */
  readonly externalAccountLabel: string | null;
}

interface HubSpotIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
}

function toRow(row: HubSpotIntegrationDbRow): HubSpotIntegrationRow {
  return {
    id: row.id,
    status: row.status,
    externalAccountLabel: row.external_account_label,
  };
}

/**
 * Read-only lookup for the page rendering the connector's real status —
 * never creates a row (unlike findOrCreateHubSpotIntegration, which the
 * OAuth callback alone should call).
 *
 * Prefers an `active` row over ordering by `created_at` alone: an
 * organization can accumulate more than one `integrations` row for
 * `hubspot` over time (a distinct row per connected HubSpot account/hub —
 * see `findOrCreateHubSpotIntegration`'s doc comment), and connecting a
 * second account, disconnecting it, then reconnecting the first would
 * otherwise surface the newer-but-disconnected row here as "not
 * connected" even while the older row is genuinely active.
 */
export async function getHubSpotIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<HubSpotIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<HubSpotIntegrationDbRow>(
      `select id, status, external_account_label from integrations
       where organization_id = $1 and source_system = 'hubspot'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific HubSpot account
 * (Hub), identified by `hubId` returned from the real OAuth token
 * exchange. Deliberately only callable from the OAuth callback, after a
 * successful exchange — `external_account_id` is protected by the
 * immutable-column trigger (0003's `integrations_immutable_identity`), so
 * there is no "create a placeholder now, fill in the real id later"
 * option; the real id must be known before the row is ever inserted.
 */
/**
 * Real disconnect: deletes the Vault-stored tokens and marks the
 * integration `disconnected` in one tenant-scoped transaction. Reconnecting
 * afterward works normally — `findOrCreateHubSpotIntegration` reactivates
 * the same row, and `storeHubSpotTokens` creates a fresh Vault secret since
 * `token_vault_secret_id` is null again. Calls the provider-neutral
 * `disconnect_integration` (0019) — nothing about this logic was ever
 * actually HubSpot-specific; Slack's disconnect (slack-integration.ts)
 * shares it rather than duplicating it.
 */
export async function disconnectHubSpotIntegration(
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

export async function findOrCreateHubSpotIntegration(
  pool: DatabasePool,
  organizationId: string,
  hubId: string,
): Promise<HubSpotIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    // A single atomic upsert rather than a separate check-then-insert —
    // two concurrent OAuth callbacks for the same account (a double-click
    // on connect, or two tabs) would otherwise both pass the "no existing
    // row" check, race on INSERT, and the loser would throw a unique-
    // violation instead of gracefully reactivating the winner's row. The
    // `external_account_id` uniqueness this relies on is
    // `integrations_org_source_account_unique` (0002); the `status`-only
    // update is safe under `integrations_immutable_identity` (0003), which
    // only guards `id`/`organization_id`/`source_system`/
    // `external_account_id`/`created_at`, never `status`.
    const result = await client.query<HubSpotIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, status)
       values ($1, $2, 'hubspot', $3, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active'
       returning id, status, external_account_label`,
      [randomUUID(), organizationId, hubId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("integrations upsert returned no row");
    }

    return toRow(row);
  });
}
