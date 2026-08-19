import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Wraps `store_hubspot_tokens`/`get_hubspot_tokens` (drizzle/0011, ADR
 * 0008) — the only sanctioned way to write or read HubSpot OAuth tokens.
 * Unlike identity.ts's functions, these run inside `withTenantContext`:
 * the caller already has a real session and tenant context by the time
 * they're connecting an integration, and the underlying functions rely on
 * RLS (via `app.current_organization_id`) for real defense in depth, not
 * just an application-level check.
 */

export interface HubSpotTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

export async function storeHubSpotTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  tokens: HubSpotTokens,
): Promise<void> {
  await withTenantContext(pool, organizationId, async (client) => {
    // `store_integration_tokens`/`get_integration_tokens` (0019) are the
    // real, provider-neutral functions now — the Vault logic behind them
    // was never actually HubSpot-specific, only the old names were, so
    // Slack's connector (slack-tokens.ts) shares this exact SQL rather
    // than duplicating it.
    await client.query(
      "select public.store_integration_tokens($1, $2, $3, $4)",
      [
        integrationId,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt,
      ],
    );
  });
}

export async function getHubSpotTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<HubSpotTokens | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{
      access_token: string;
      refresh_token: string;
      expires_at: Date;
    }>(
      "select access_token, refresh_token, expires_at from public.get_integration_tokens($1)",
      [integrationId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
    };
  });
}
