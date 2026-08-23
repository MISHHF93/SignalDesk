"use server";

import { redirect } from "next/navigation";

import { revokeZendeskAccessToken } from "@signaldesk/integrations/zendesk";
import {
  createDatabasePool,
  disconnectZendeskIntegration,
  getZendeskIntegrationStatus,
  getZendeskTokens,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectZendeskState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: attempts remote revocation (best-effort — see
 * `revokeZendeskAccessToken`'s doc comment on why this never blocks the
 * local step; unlike Jira, Zendesk has a genuine working revoke
 * endpoint), then deletes the Vault-stored tokens and marks the
 * integration disconnected, then records the audit event. Mirrors
 * `disconnectXeroAction`'s exact policy — revokes the *access* token, not
 * a refresh token, matching `DELETE .../tokens/current.json`'s real
 * semantics (see client.ts).
 */
export async function disconnectZendeskAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectZendeskState,
): Promise<DisconnectZendeskState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  const integration = await getZendeskIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Zendesk is not currently connected." };
  }

  try {
    const tokens = await getZendeskTokens(
      getPool(),
      session.organizationId,
      integration.id,
    );

    if (tokens) {
      const revoked = await revokeZendeskAccessToken(
        integration.externalAccountId,
        tokens.accessToken,
      );

      if (!revoked) {
        console.error(
          `Zendesk remote token revocation failed for integration ${integration.id}; proceeding with local disconnect anyway`,
        );
      }
    }

    await disconnectZendeskIntegration(
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
      metadata: { sourceSystem: "zendesk" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect Zendesk."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/zendesk?zendesk=disconnected");
}
