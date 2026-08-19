"use server";

import { redirect } from "next/navigation";

import { revokeQuickBooksToken } from "@business-dashboard/integrations/quickbooks";
import {
  createDatabasePool,
  disconnectQuickBooksIntegration,
  getQuickBooksIntegrationStatus,
  getQuickBooksTokens,
  recordAuditEvent,
} from "@business-dashboard/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import {
  getQuickBooksClientCredentialsForRevoke,
  isQuickBooksConfigured,
} from "../_lib/quickbooks-config";
import { getCurrentOrganization } from "../_lib/session";

export interface DisconnectQuickBooksState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: attempts remote revocation of the refresh token (which
 * invalidates the whole grant — see client.ts's doc comment), then deletes
 * the Vault-stored tokens and marks the integration disconnected, then
 * records the audit event. Mirrors `disconnectHubSpotAction`'s "never
 * blocks the local step" contract exactly.
 */
export async function disconnectQuickBooksAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectQuickBooksState,
): Promise<DisconnectQuickBooksState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  const integration = await getQuickBooksIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "QuickBooks is not currently connected." };
  }

  try {
    if (isQuickBooksConfigured()) {
      const tokens = await getQuickBooksTokens(
        getPool(),
        session.organizationId,
        integration.id,
      );

      if (tokens) {
        const revoked = await revokeQuickBooksToken(
          getQuickBooksClientCredentialsForRevoke(),
          tokens.refreshToken,
        );

        if (!revoked) {
          console.error(
            `QuickBooks remote token revocation failed for integration ${integration.id}; proceeding with local disconnect anyway`,
          );
        }
      }
    }

    await disconnectQuickBooksIntegration(
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
      metadata: { sourceSystem: "quickbooks" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect QuickBooks."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/quickbooks?quickbooks=disconnected");
}
