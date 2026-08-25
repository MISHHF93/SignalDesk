"use server";

import { redirect } from "next/navigation";

import { revokeHubSpotRefreshToken } from "@signaldesk/integrations/hubspot";
import {
  createDatabasePool,
  disconnectHubSpotIntegration,
  getHubSpotIntegrationStatus,
  getHubSpotTokens,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectHubSpotState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: attempts remote revocation (best-effort — see
 * `revokeHubSpotRefreshToken`'s doc comment on why this never blocks the
 * local step), then deletes the Vault-stored tokens and marks the
 * integration disconnected (0016), then records the audit event. A failed
 * remote revocation is logged but does not stop the local disconnect from
 * completing — the customer's expectation ("this app no longer has access
 * to my data") is satisfied by the local step regardless.
 */
export async function disconnectHubSpotAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectHubSpotState,
): Promise<DisconnectHubSpotState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only an owner or admin can manage this connection." };
  }

  const integration = await getHubSpotIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "HubSpot is not currently connected." };
  }

  try {
    const tokens = await getHubSpotTokens(
      getPool(),
      session.organizationId,
      integration.id,
    );

    if (tokens) {
      const revoked = await revokeHubSpotRefreshToken(
        tokens.accessToken,
        tokens.refreshToken,
      );

      if (!revoked) {
        console.error(
          `HubSpot remote token revocation failed for integration ${integration.id}; proceeding with local disconnect anyway`,
        );
      }
    }

    await disconnectHubSpotIntegration(
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
      metadata: { sourceSystem: "hubspot" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect HubSpot."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/hubspot?hubspot=disconnected");
}
