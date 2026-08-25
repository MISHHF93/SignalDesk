"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { revokeAsanaToken } from "@signaldesk/integrations/asana";
import {
  createDatabasePool,
  disconnectAsanaIntegration,
  getAsanaIntegrationStatus,
  getAsanaTokens,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { getAsanaOAuthConfig, isAsanaConfigured } from "../_lib/asana-config";
import { describeActionError } from "../_lib/describe-action-error";
import { logger } from "../_lib/logger";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectAsanaState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: attempts remote revocation of the refresh token
 * (best-effort, mirroring `disconnectHubSpotAction`'s "never blocks the
 * local step" contract), then deletes the Vault-stored tokens and marks
 * the integration disconnected, then records the audit event.
 */
export async function disconnectAsanaAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectAsanaState,
): Promise<DisconnectAsanaState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only an owner or admin can manage this connection." };
  }

  const integration = await getAsanaIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Asana is not currently connected." };
  }

  try {
    if (isAsanaConfigured()) {
      const tokens = await getAsanaTokens(
        getPool(),
        session.organizationId,
        integration.id,
      );

      if (tokens) {
        const origin = (await headers()).get("origin") ?? "";
        const config = getAsanaOAuthConfig(origin);
        const revoked = await revokeAsanaToken(config, tokens.refreshToken);

        if (!revoked) {
          logger.log(
            "warn",
            "Asana remote token revocation failed; proceeding with local disconnect anyway",
            {
              operation: "asana_disconnect.revoke_token",
              connectorSlug: "asana",
              organizationId: session.organizationId,
              correlationId: integration.id,
            },
          );
        }
      }
    }

    await disconnectAsanaIntegration(
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
      metadata: { sourceSystem: "asana" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect Asana."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/asana?asana=disconnected");
}
