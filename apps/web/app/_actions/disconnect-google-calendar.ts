"use server";

import { redirect } from "next/navigation";

import { revokeGoogleCalendarToken } from "@business-dashboard/integrations/google-calendar";
import {
  createDatabasePool,
  disconnectGoogleCalendarIntegration,
  getGoogleCalendarIntegrationStatus,
  getGoogleCalendarTokens,
  recordAuditEvent,
} from "@business-dashboard/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectGoogleCalendarState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: attempts remote revocation (best-effort), then deletes
 * the Vault-stored tokens and marks the integration disconnected, then
 * records the audit event. Mirrors `disconnectGmailAction` exactly.
 */
export async function disconnectGoogleCalendarAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectGoogleCalendarState,
): Promise<DisconnectGoogleCalendarState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  const integration = await getGoogleCalendarIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Google Calendar is not currently connected." };
  }

  try {
    const tokens = await getGoogleCalendarTokens(
      getPool(),
      session.organizationId,
      integration.id,
    );

    if (tokens) {
      const revoked = await revokeGoogleCalendarToken(tokens.refreshToken);

      if (!revoked) {
        console.error(
          `Google Calendar remote token revocation failed for integration ${integration.id}; proceeding with local disconnect anyway`,
        );
      }
    }

    await disconnectGoogleCalendarIntegration(
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
      metadata: { sourceSystem: "google-calendar" },
    });
  } catch (error) {
    return {
      error: describeActionError(
        error,
        "Failed to disconnect Google Calendar.",
      ),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/google-calendar?google-calendar=disconnected");
}
