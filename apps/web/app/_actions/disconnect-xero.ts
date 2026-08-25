"use server";

import { redirect } from "next/navigation";

import { revokeXeroRefreshToken } from "@signaldesk/integrations/xero";
import {
  createDatabasePool,
  disconnectXeroIntegration,
  getXeroIntegrationStatus,
  getXeroTokens,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";
import { getXeroClientCredentials } from "../_lib/xero-config";

export interface DisconnectXeroState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: attempts remote revocation (best-effort — see
 * `revokeXeroRefreshToken`'s doc comment on why this never blocks the
 * local step), then deletes the Vault-stored tokens and marks the
 * integration disconnected, then records the audit event. Mirrors
 * `disconnectSalesforceAction`'s exact policy.
 */
export async function disconnectXeroAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectXeroState,
): Promise<DisconnectXeroState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only an owner or admin can manage this connection." };
  }

  const integration = await getXeroIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Xero is not currently connected." };
  }

  try {
    const tokens = await getXeroTokens(
      getPool(),
      session.organizationId,
      integration.id,
    );

    if (tokens) {
      const config = getXeroClientCredentials();
      const revoked = await revokeXeroRefreshToken(config, tokens.refreshToken);

      if (!revoked) {
        console.error(
          `Xero remote token revocation failed for integration ${integration.id}; proceeding with local disconnect anyway`,
        );
      }
    }

    await disconnectXeroIntegration(
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
      metadata: { sourceSystem: "xero" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect Xero."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/xero?xero=disconnected");
}
