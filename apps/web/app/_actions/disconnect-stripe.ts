"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { deauthorizeStripeAccount } from "@business-dashboard/integrations/stripe";
import {
  createDatabasePool,
  disconnectStripeIntegration,
  getStripeIntegrationStatus,
  recordAuditEvent,
} from "@business-dashboard/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";
import {
  getStripeOAuthConfig,
  isStripeConfigured,
} from "../_lib/stripe-config";

export interface DisconnectStripeState {
  readonly error: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Real disconnect: attempts remote deauthorization (best-effort, mirroring
 * `disconnectHubSpotAction`'s "never blocks the local step" contract), then
 * marks the integration disconnected, then records the audit event.
 * Deauthorization needs the platform's own Stripe credentials (the
 * connected account never held one to revoke itself, per client.ts's doc
 * comment) — if those aren't configured, the remote call is skipped
 * entirely and only the local disconnect runs, same end state a customer
 * cares about.
 */
export async function disconnectStripeAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DisconnectStripeState,
): Promise<DisconnectStripeState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage this connection." };
  }

  const integration = await getStripeIntegrationStatus(
    getPool(),
    session.organizationId,
  );

  if (!integration || integration.status !== "active") {
    return { error: "Stripe is not currently connected." };
  }

  try {
    if (isStripeConfigured()) {
      const origin = (await headers()).get("origin") ?? "";
      const config = getStripeOAuthConfig(origin);
      const revoked = await deauthorizeStripeAccount(
        config,
        integration.externalAccountId,
      );

      if (!revoked) {
        console.error(
          `Stripe remote deauthorization failed for integration ${integration.id}; proceeding with local disconnect anyway`,
        );
      }
    }

    await disconnectStripeIntegration(
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
      metadata: { sourceSystem: "stripe" },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to disconnect Stripe."),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect.
  redirect("/integrations/stripe?stripe=disconnected");
}
