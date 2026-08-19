"use server";

import { redirect } from "next/navigation";

import {
  createDatabasePool,
  disconnectMicrosoftCalendarIntegration,
  getMicrosoftCalendarIntegrationStatus,
  recordAuditEvent,
} from "@business-dashboard/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectMicrosoftCalendarState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect, local-only — same reasoning as
 * `disconnectMicrosoftOutlookAction` (no Microsoft revoke endpoint
 * exists for third-party apps to call).
 */
export async function disconnectMicrosoftCalendarAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectMicrosoftCalendarState,
): Promise<DisconnectMicrosoftCalendarState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  const integration = await getMicrosoftCalendarIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Microsoft Calendar is not currently connected." };
  }

  try {
    await disconnectMicrosoftCalendarIntegration(
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
      metadata: { sourceSystem: "microsoft-calendar" },
    });
  } catch (error) {
    return {
      error: describeActionError(
        error,
        "Failed to disconnect Microsoft Calendar.",
      ),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/microsoft-calendar?microsoft-calendar=disconnected");
}
