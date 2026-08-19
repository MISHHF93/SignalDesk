"use server";

import { redirect } from "next/navigation";

import {
  createDatabasePool,
  disconnectMicrosoftOutlookIntegration,
  getMicrosoftOutlookIntegrationStatus,
  recordAuditEvent,
} from "@business-dashboard/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectMicrosoftOutlookState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: deletes the Vault-stored tokens and marks the
 * integration disconnected, then records the audit event. No remote
 * revocation call — unlike every other connector's disconnect action,
 * there is nothing to attempt: Microsoft has no documented third-party
 * single-token revoke endpoint (see `packages/integrations/src/shared/
 * microsoft-oauth.ts`'s doc comment). The customer's expectation ("this
 * app no longer has access to my data") is still fully satisfied by the
 * local step — the stored token becomes unusable and is deleted — but a
 * customer who wants Microsoft's own record of the grant removed needs to
 * do that themselves at https://myapps.microsoft.com.
 */
export async function disconnectMicrosoftOutlookAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectMicrosoftOutlookState,
): Promise<DisconnectMicrosoftOutlookState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  const integration = await getMicrosoftOutlookIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Outlook is not currently connected." };
  }

  try {
    await disconnectMicrosoftOutlookIntegration(
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
      metadata: { sourceSystem: "microsoft-outlook" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect Outlook."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/microsoft-outlook?microsoft-outlook=disconnected");
}
