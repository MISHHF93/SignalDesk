"use server";

import {
  createDatabasePool,
  recordAuditEvent,
  upsertAIProviderConnection,
  type AIProviderName,
  type DatabasePool,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export interface ConnectAIProviderState {
  readonly error: string | null;
  readonly message: string | null;
}

const SUPPORTED_PROVIDERS = new Set<AIProviderName>(["anthropic"]);

/**
 * Saves a real, per-organization AI provider API key (Phase 4c,
 * implementation roadmap) — Vault-encrypted via `upsertAIProviderConnection`
 * (`@signaldesk/persistence`), same real "encryption key lives outside
 * this database entirely" guarantee every connector's OAuth token
 * already has. Owner/admin only, same authorization pattern
 * `inviteMemberAction` already uses. Grants zero new action-execution
 * capability — this only changes which key funds the Agent Fabric's
 * already-existing, already-approval-gated `interpret_findings` calls.
 */
export async function connectAIProviderAction(
  _prevState: ConnectAIProviderState,
  formData: FormData,
): Promise<ConnectAIProviderState> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { error: "Sign in to do this.", message: null };
    }

    if (session.role !== "owner" && session.role !== "admin") {
      return {
        error: "Only an owner or admin can connect an AI provider.",
        message: null,
      };
    }

    const rateLimit = await checkRateLimit(
      getPool(),
      `connect-ai-provider:${session.organizationId}`,
      10,
      60 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      return {
        error: "Too many attempts. Try again shortly.",
        message: null,
      };
    }

    const provider = String(formData.get("provider") ?? "");
    const apiKey = String(formData.get("apiKey") ?? "").trim();

    if (!SUPPORTED_PROVIDERS.has(provider as AIProviderName)) {
      return { error: "Choose a supported AI provider.", message: null };
    }

    if (!apiKey) {
      return { error: "Enter a real API key.", message: null };
    }

    await upsertAIProviderConnection(
      getPool(),
      session.organizationId,
      provider as AIProviderName,
      apiKey,
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "ai_provider.connected",
      subjectType: "ai_provider_connection",
      subjectId: provider,
      outcome: "succeeded",
      metadata: { provider },
    });

    return { error: null, message: `${provider} key saved.` };
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to save the AI provider key."),
      message: null,
    };
  }
}
