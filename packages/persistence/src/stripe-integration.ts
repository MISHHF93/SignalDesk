import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface StripeIntegrationRow {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
  /** The connected Stripe account id (`acct_...`) — unlike HubSpot/Slack,
   * Stripe's disconnect call needs this directly rather than a stored
   * token, so it's exposed here rather than only living in the database. */
  readonly externalAccountId: string;
}

interface StripeIntegrationDbRow {
  readonly id: string;
  readonly status: string;
  readonly external_account_label: string | null;
  readonly external_account_id: string;
}

function toRow(row: StripeIntegrationDbRow): StripeIntegrationRow {
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
 * active row" logic exactly — see that function's doc comment for why a
 * plain `created_at desc` isn't enough once an organization has connected
 * more than one Stripe account.
 */
export async function getStripeIntegrationStatus(
  pool: DatabasePool,
  organizationId: string,
): Promise<StripeIntegrationRow | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<StripeIntegrationDbRow>(
      `select id, status, external_account_label, external_account_id from integrations
       where organization_id = $1 and source_system = 'stripe'
       order by (status = 'active') desc, created_at desc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];
    return row ? toRow(row) : null;
  });
}

/**
 * Finds or creates the integration row for a specific Stripe account,
 * identified by `stripeUserId` returned from the real OAuth token exchange.
 * Same atomic-upsert pattern as `findOrCreateHubSpotIntegration` (race-safe
 * against a double-click or two tabs). Unlike every other connector here,
 * no token is ever stored: Stripe's own current docs mark the OAuth
 * response's access/refresh tokens "(Deprecated)" in favor of the
 * platform's own secret key plus a `Stripe-Account` header, so there is
 * nothing per-tenant to put in Vault — the account id itself, stored as
 * `external_account_id`, is the only durable state this connection needs.
 */
export async function findOrCreateStripeIntegration(
  pool: DatabasePool,
  organizationId: string,
  stripeUserId: string,
): Promise<StripeIntegrationRow> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<StripeIntegrationDbRow>(
      `insert into integrations (id, organization_id, source_system, external_account_id, status)
       values ($1, $2, 'stripe', $3, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active'
       returning id, status, external_account_label, external_account_id`,
      [randomUUID(), organizationId, stripeUserId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("integrations upsert returned no row");
    }

    return toRow(row);
  });
}

/**
 * Marks the integration `disconnected`. Calls the same provider-neutral
 * `disconnect_integration` (0019) HubSpot's and Slack's disconnect use —
 * safe to reuse even though Stripe never populates `token_vault_secret_id`,
 * since that function is a no-op on the Vault-delete step when the column
 * is already null.
 */
export async function disconnectStripeIntegration(
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
