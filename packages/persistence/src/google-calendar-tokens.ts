import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Wraps the provider-neutral `store_integration_tokens`/
 * `get_integration_tokens` (0019) for Google Calendar — mirrors
 * `gmail-tokens.ts` exactly (both are Google OAuth grants with the same
 * expiring access-token-plus-durable-refresh-token shape).
 */

export interface GoogleCalendarTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

export async function storeGoogleCalendarTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  tokens: GoogleCalendarTokens,
): Promise<void> {
  await withTenantContext(pool, organizationId, async (client) => {
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

export async function getGoogleCalendarTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<GoogleCalendarTokens | null> {
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
