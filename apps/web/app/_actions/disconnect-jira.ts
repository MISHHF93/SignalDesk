"use server";

import { redirect } from "next/navigation";

import {
  createDatabasePool,
  disconnectJiraIntegration,
  getJiraIntegrationStatus,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectJiraState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: deletes the Vault-stored tokens and marks the
 * integration disconnected, then records the audit event. Unlike every
 * other connector's disconnect action, there is no remote-revocation step
 * — Atlassian has no programmatic revoke endpoint for OAuth 2.0 (3LO)
 * grants at all (see `packages/integrations/src/jira/client.ts`'s
 * top-of-file doc comment); only the user can revoke Jira's access, via
 * their own Atlassian account settings. Disclosed in the connector's UI
 * copy (`oauth-connectors.tsx`), not silently different from the others.
 */
export async function disconnectJiraAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectJiraState,
): Promise<DisconnectJiraState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only an owner or admin can manage this connection." };
  }

  const integration = await getJiraIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Jira is not currently connected." };
  }

  try {
    await disconnectJiraIntegration(
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
      metadata: { sourceSystem: "jira" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect Jira."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/jira?jira=disconnected");
}
