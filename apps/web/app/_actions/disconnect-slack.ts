"use server";

import { redirect } from "next/navigation";

import { revokeSlackToken } from "@signaldesk/integrations/slack";
import {
  createDatabasePool,
  disconnectSlackIntegration,
  getSlackIntegrationStatus,
  getSlackTokens,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectSlackState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: attempts remote revocation (best-effort — see
 * `revokeSlackToken`'s doc comment on why this never blocks the local
 * step), then deletes the Vault-stored token and marks the integration
 * disconnected, then records the audit event. Mirrors
 * `disconnectHubSpotAction`'s exact policy.
 */
export async function disconnectSlackAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectSlackState,
): Promise<DisconnectSlackState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only an owner or admin can manage this connection." };
  }

  const integration = await getSlackIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Slack is not currently connected." };
  }

  try {
    const tokens = await getSlackTokens(
      getPool(),
      session.organizationId,
      integration.id,
    );

    if (tokens) {
      const revoked = await revokeSlackToken(tokens.accessToken);

      if (!revoked) {
        console.error(
          `Slack remote token revocation failed for integration ${integration.id}; proceeding with local disconnect anyway`,
        );
      }
    }

    await disconnectSlackIntegration(
      getPool(),
      session.organizationId,
      integration.id,
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "integration.disconnected",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: { sourceSystem: "slack" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect Slack."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/slack?slack=disconnected");
}
