import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Wraps the provider-neutral `store_integration_tokens`/
 * `get_integration_tokens` (0019) for Microsoft Calendar — mirrors
 * `microsoft-outlook-tokens.ts` exactly.
 */

export interface MicrosoftCalendarTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

export async function storeMicrosoftCalendarTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  tokens: MicrosoftCalendarTokens,
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

/**
 * No production caller today — unlike most connectors' disconnect
 * actions, `disconnectMicrosoftCalendarAction` never reads the stored
 * token back to revoke it, because Microsoft has no real third-party
 * token-revoke endpoint to call (see that action's own doc comment).
 * Kept real and tested (not deleted) as the honest counterpart to
 * `storeMicrosoftCalendarTokens` for whenever a real read path (a token
 * refresh, a "last connected" detail view) needs it — found unwired in
 * a dead-code audit this session and disclosed here rather than left
 * undocumented.
 */
export async function getMicrosoftCalendarTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<MicrosoftCalendarTokens | null> {
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
