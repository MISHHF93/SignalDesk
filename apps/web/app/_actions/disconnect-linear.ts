"use server";

import { redirect } from "next/navigation";

import { revokeLinearToken } from "@business-dashboard/integrations/linear";
import {
  createDatabasePool,
  disconnectLinearIntegration,
  getLinearIntegrationStatus,
  getLinearTokens,
  recordAuditEvent,
} from "@business-dashboard/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectLinearState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: attempts remote revocation of the refresh token
 * (best-effort), then deletes the Vault-stored tokens and marks the
 * integration disconnected, then records the audit event. Unlike
 * Asana's revoke call, Linear's doesn't need client credentials — just
 * the token itself (see `linear/client.ts`'s doc comment).
 */
export async function disconnectLinearAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectLinearState,
): Promise<DisconnectLinearState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  const integration = await getLinearIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Linear is not currently connected." };
  }

  try {
    const tokens = await getLinearTokens(
      getPool(),
      session.organizationId,
      integration.id,
    );

    if (tokens) {
      const revoked = await revokeLinearToken(tokens.refreshToken);

      if (!revoked) {
        console.error(
          `Linear remote token revocation failed for integration ${integration.id}; proceeding with local disconnect anyway`,
        );
      }
    }

    await disconnectLinearIntegration(
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
      metadata: { sourceSystem: "linear" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect Linear."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/linear?linear=disconnected");
}
