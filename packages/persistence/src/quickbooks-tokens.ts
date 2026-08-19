import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Wraps the provider-neutral `store_integration_tokens`/
 * `get_integration_tokens` (0019) for QuickBooks — its access and refresh
 * tokens both genuinely expire (1 hour / ~100 days, per client.ts's doc
 * comment), the same shape HubSpot's tokens already have, so this mirrors
 * `hubspot-tokens.ts` exactly rather than introducing a new shape.
 */

export interface QuickBooksTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

export async function storeQuickBooksTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  tokens: QuickBooksTokens,
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

export async function getQuickBooksTokens(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
): Promise<QuickBooksTokens | null> {
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
