import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface SalesforceTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Stores the Salesforce access/refresh token pair via the same
 * provider-neutral `store_integration_tokens` (0019) HubSpot's and Slack's
 * token storage use — passes `null` for `expires_at` rather than
 * fabricating one: Salesforce's OAuth response never discloses a real
 * token lifetime (see `SalesforceTokenResponse`'s doc comment in
 * `@signaldesk/integrations/salesforce`), unlike every other connector
 * this table also stores tokens for.
 */
export async function storeSalesforceTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  tokens: SalesforceTokens,
): Promise<void> {
  await withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      "select public.store_integration_tokens($1, $2, $3, $4)",
      [integrationId, tokens.accessToken, tokens.refreshToken, null],
    );
  });
}

export async function getSalesforceTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<SalesforceTokens | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{
      access_token: string;
      refresh_token: string;
    }>(
      "select access_token, refresh_token from public.get_integration_tokens($1)",
      [integrationId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return { accessToken: row.access_token, refreshToken: row.refresh_token };
  });
}
