import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Real, per-organization AI provider API keys (Phase 4c, implementation
 * roadmap) — lets an org fund the Agent Fabric's already-existing,
 * already-approval-gated `interpret_findings` calls with its own
 * Anthropic key instead of the platform-wide `ANTHROPIC_API_KEY`. Grants
 * zero new action-execution capability: `canExecute` stays
 * `z.literal(false)` everywhere, completely untouched by this file.
 *
 * Only `"anthropic"` is a real, meaningful value today — the one real
 * `AIProvider` implementation (`createClaudeProvider`,
 * `@signaldesk/application`) — matching `ai_provider_connections_
 * provider_allowed`'s own check constraint.
 */
export type AIProviderName = "anthropic";

export interface AIProviderConnectionStatus {
  readonly connected: boolean;
  readonly updatedAt: Date | null;
}

interface AIProviderConnectionRow {
  readonly id: string;
  readonly updated_at: Date;
}

/**
 * Creates a real connection row (if one doesn't already exist for this
 * org+provider) and stores the key in Vault via `store_ai_provider_key`
 * — a real, live-tested round trip (create-secret on first save,
 * update-secret on every subsequent one). Never returns the key itself.
 */
export async function upsertAIProviderConnection(
  pool: DatabasePool,
  organizationId: string,
  provider: AIProviderName,
  apiKey: string,
): Promise<void> {
  await withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ id: string }>(
      `insert into ai_provider_connections (id, organization_id, provider)
       values ($1, $2, $3)
       on conflict (organization_id, provider)
       do update set enabled = true, updated_at = now()
       returning id`,
      [randomUUID(), organizationId, provider],
    );

    const connectionId = result.rows[0]?.id;

    if (!connectionId) {
      throw new Error("ai_provider_connections upsert returned no row");
    }

    await client.query("select public.store_ai_provider_key($1, $2)", [
      connectionId,
      apiKey,
    ]);
  });
}

/**
 * Real connection status for the Profile UI — connected/not-connected
 * and when it was last updated, never the key itself.
 */
export async function getAIProviderConnectionStatus(
  pool: DatabasePool,
  organizationId: string,
  provider: AIProviderName,
): Promise<AIProviderConnectionStatus> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<AIProviderConnectionRow>(
      `select id, updated_at from ai_provider_connections
       where organization_id = $1 and provider = $2 and enabled = true
       limit 1`,
      [organizationId, provider],
    );

    const row = result.rows[0];

    return row
      ? { connected: true, updatedAt: row.updated_at }
      : { connected: false, updatedAt: null };
  });
}

/**
 * Real, server-side-only key resolution — used exclusively by
 * `providerFor` (`apps/web/app/_lib/agent-fabric.ts`) to fund a real
 * Claude call. Never returned by any Server Action response.
 */
export async function getAIProviderApiKey(
  pool: DatabasePool,
  organizationId: string,
  provider: AIProviderName,
): Promise<string | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ id: string }>(
      `select id from ai_provider_connections
       where organization_id = $1 and provider = $2 and enabled = true
       limit 1`,
      [organizationId, provider],
    );

    const connectionId = result.rows[0]?.id;

    if (!connectionId) {
      return null;
    }

    const keyResult = await client.query<{
      get_ai_provider_key: string | null;
    }>("select public.get_ai_provider_key($1)", [connectionId]);

    return keyResult.rows[0]?.get_ai_provider_key ?? null;
  });
}

/**
 * Real disconnect: deletes the Vault-stored key and the connection row
 * itself via `delete_ai_provider_connection`. A no-op, not an error, for
 * a provider that was never connected — matching this app's general
 * idempotent-write convention.
 */
export async function deleteAIProviderConnection(
  pool: DatabasePool,
  organizationId: string,
  provider: AIProviderName,
): Promise<void> {
  await withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ id: string }>(
      `select id from ai_provider_connections
       where organization_id = $1 and provider = $2
       limit 1`,
      [organizationId, provider],
    );

    const connectionId = result.rows[0]?.id;

    if (!connectionId) {
      return;
    }

    await client.query("select public.delete_ai_provider_connection($1)", [
      connectionId,
    ]);
  });
}
