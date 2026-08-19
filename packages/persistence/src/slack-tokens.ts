import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface SlackTokens {
  /** A bot token (`xoxb-...`). No refresh token or expiry: Slack's
   * standard OAuth v2 flow issues persistent bot tokens by default — see
   * `SlackTokenResponse`'s doc comment in
   * `@signaldesk/integrations/slack` for the source. */
  readonly accessToken: string;
}

/**
 * Stores the Slack bot token via the same provider-neutral
 * `store_integration_tokens` (0019) HubSpot's token storage uses — passes
 * `null` for refresh token/expiry rather than forcing HubSpot's
 * always-expiring assumption onto a provider whose tokens don't expire.
 */
export async function storeSlackTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  tokens: SlackTokens,
): Promise<void> {
  await withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      "select public.store_integration_tokens($1, $2, $3, $4)",
      [integrationId, tokens.accessToken, null, null],
    );
  });
}

export async function getSlackTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<SlackTokens | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ access_token: string }>(
      "select access_token from public.get_integration_tokens($1)",
      [integrationId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return { accessToken: row.access_token };
  });
}
