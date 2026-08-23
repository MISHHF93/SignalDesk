"use server";

import {
  createDatabasePool,
  deleteAIProviderConnection,
  recordAuditEvent,
  type AIProviderName,
  type DatabasePool,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export type DisconnectAIProviderActionResult =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

/**
 * Removes a real, per-organization AI provider connection (Phase 4c,
 * implementation roadmap) — deletes the Vault-stored key and the
 * connection row via `deleteAIProviderConnection`. Owner/admin only,
 * same authorization pattern `revokeInviteAction` already uses.
 */
export async function disconnectAIProviderAction(
  provider: AIProviderName,
): Promise<DisconnectAIProviderActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    if (session.role !== "owner" && session.role !== "admin") {
      return {
        ok: false,
        error: "Only an owner or admin can disconnect an AI provider.",
      };
    }

    await deleteAIProviderConnection(
      getPool(),
      session.organizationId,
      provider,
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "ai_provider.disconnected",
      subjectType: "ai_provider_connection",
      subjectId: provider,
      outcome: "succeeded",
      metadata: { provider },
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(
        error,
        "Failed to disconnect the AI provider.",
      ),
    };
  }
}
