"use server";

import { redirect } from "next/navigation";

import { revokeGmailToken } from "@signaldesk/integrations/gmail";
import {
  createDatabasePool,
  disconnectGmailIntegration,
  getGmailIntegrationStatus,
  getGmailTokens,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectGmailState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: attempts remote revocation (best-effort, mirroring
 * `disconnectHubSpotAction`'s "never blocks the local step" contract),
 * then deletes the Vault-stored tokens and marks the integration
 * disconnected, then records the audit event.
 */
export async function disconnectGmailAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectGmailState,
): Promise<DisconnectGmailState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only an owner or admin can manage this connection." };
  }

  const integration = await getGmailIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Gmail is not currently connected." };
  }

  try {
    const tokens = await getGmailTokens(
      getPool(),
      session.organizationId,
      integration.id,
    );

    if (tokens) {
      const revoked = await revokeGmailToken(tokens.refreshToken);

      if (!revoked) {
        console.error(
          `Gmail remote token revocation failed for integration ${integration.id}; proceeding with local disconnect anyway`,
        );
      }
    }

    await disconnectGmailIntegration(
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
      metadata: { sourceSystem: "gmail" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect Gmail."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/gmail?gmail=disconnected");
}
