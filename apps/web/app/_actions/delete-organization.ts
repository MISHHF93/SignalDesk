"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { revokeAsanaToken } from "@signaldesk/integrations/asana";
import { revokeGmailToken } from "@signaldesk/integrations/gmail";
import { revokeGoogleCalendarToken } from "@signaldesk/integrations/google-calendar";
import { revokeHubSpotRefreshToken } from "@signaldesk/integrations/hubspot";
import { revokeLinearToken } from "@signaldesk/integrations/linear";
import { revokeQuickBooksToken } from "@signaldesk/integrations/quickbooks";
import { revokeSalesforceRefreshToken } from "@signaldesk/integrations/salesforce";
import { revokeSlackToken } from "@signaldesk/integrations/slack";
import { deauthorizeStripeAccount } from "@signaldesk/integrations/stripe";
import {
  cancelSubscriptionAtPeriodEnd,
  createStripeBillingClient,
} from "@signaldesk/integrations/stripe-billing";
import { revokeXeroRefreshToken } from "@signaldesk/integrations/xero";
import { revokeZendeskAccessToken } from "@signaldesk/integrations/zendesk";
import {
  anonymizeOrganization,
  createDatabasePool,
  disconnectAsanaIntegration,
  disconnectGmailIntegration,
  disconnectGoogleCalendarIntegration,
  disconnectHubSpotIntegration,
  disconnectJiraIntegration,
  disconnectLinearIntegration,
  disconnectMicrosoftCalendarIntegration,
  disconnectMicrosoftOutlookIntegration,
  disconnectQuickBooksIntegration,
  disconnectSalesforceIntegration,
  disconnectSlackIntegration,
  disconnectStripeIntegration,
  disconnectXeroIntegration,
  disconnectZendeskIntegration,
  getAsanaTokens,
  getGmailTokens,
  getGoogleCalendarTokens,
  getHubSpotTokens,
  getLinearTokens,
  getOrganizationSubscription,
  getQuickBooksTokens,
  getSalesforceTokens,
  getSlackTokens,
  getXeroTokens,
  getZendeskTokens,
  listConnectorConnections,
  recordAuditEvent,
  type ConnectorConnection,
  type DatabasePool,
} from "@signaldesk/persistence";

import { getAsanaOAuthConfig, isAsanaConfigured } from "../_lib/asana-config";
import { describeActionError } from "../_lib/describe-action-error";
import { errorReporter } from "../_lib/error-reporter";
import { logger } from "../_lib/logger";
import {
  getQuickBooksClientCredentials,
  isQuickBooksConfigured,
} from "../_lib/quickbooks-config";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { getStripeSecretKey } from "../_lib/stripe-billing-config";
import {
  getStripeOAuthConfig,
  isStripeConfigured,
} from "../_lib/stripe-config";
import { getXeroClientCredentials } from "../_lib/xero-config";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const DISCONNECT_BY_SOURCE_SYSTEM: Record<
  string,
  (
    pool: DatabasePool,
    organizationId: string,
    integrationId: string,
  ) => Promise<void>
> = {
  hubspot: disconnectHubSpotIntegration,
  quickbooks: disconnectQuickBooksIntegration,
  asana: disconnectAsanaIntegration,
  slack: disconnectSlackIntegration,
  stripe: disconnectStripeIntegration,
  gmail: disconnectGmailIntegration,
  "google-calendar": disconnectGoogleCalendarIntegration,
  "microsoft-calendar": disconnectMicrosoftCalendarIntegration,
  "microsoft-outlook": disconnectMicrosoftOutlookIntegration,
  linear: disconnectLinearIntegration,
  salesforce: disconnectSalesforceIntegration,
  xero: disconnectXeroIntegration,
  jira: disconnectJiraIntegration,
  zendesk: disconnectZendeskIntegration,
};

export interface DeleteOrganizationState {
  readonly error: string | null;
}

/**
 * Attempts remote OAuth token revocation for one connector, mirroring the
 * exact best-effort logic each connector's own dedicated `disconnectXxxAction`
 * uses (see e.g. `disconnect-hubspot.ts`) — a failed or skipped remote call
 * never blocks the local disconnect. `microsoft-calendar`,
 * `microsoft-outlook`, and `jira` are deliberately absent from the switch:
 * none of their dedicated disconnect actions attempt remote revocation
 * either, since no third-party revoke endpoint exists for those providers
 * (see each one's own doc comment). Without this step, deleting an
 * organization would leave every other connector's OAuth grant live at the
 * provider while this page's copy claims full disconnection — a truthful-
 * evidence violation this function exists to close.
 */
async function revokeRemoteAccess(
  db: DatabasePool,
  organizationId: string,
  connection: ConnectorConnection,
): Promise<void> {
  const { id: integrationId, sourceSystem, externalAccountId } = connection;

  try {
    let revoked: boolean | null = null;

    switch (sourceSystem) {
      case "hubspot": {
        const tokens = await getHubSpotTokens(
          db,
          organizationId,
          integrationId,
        );
        if (tokens) {
          revoked = await revokeHubSpotRefreshToken(
            tokens.accessToken,
            tokens.refreshToken,
          );
        }
        break;
      }
      case "quickbooks": {
        if (isQuickBooksConfigured()) {
          const tokens = await getQuickBooksTokens(
            db,
            organizationId,
            integrationId,
          );
          if (tokens) {
            revoked = await revokeQuickBooksToken(
              getQuickBooksClientCredentials(),
              tokens.refreshToken,
            );
          }
        }
        break;
      }
      case "asana": {
        if (isAsanaConfigured()) {
          const tokens = await getAsanaTokens(
            db,
            organizationId,
            integrationId,
          );
          if (tokens) {
            const origin = (await headers()).get("origin") ?? "";
            const config = getAsanaOAuthConfig(origin);
            revoked = await revokeAsanaToken(config, tokens.refreshToken);
          }
        }
        break;
      }
      case "slack": {
        const tokens = await getSlackTokens(db, organizationId, integrationId);
        if (tokens) {
          revoked = await revokeSlackToken(tokens.accessToken);
        }
        break;
      }
      case "gmail": {
        const tokens = await getGmailTokens(db, organizationId, integrationId);
        if (tokens) {
          revoked = await revokeGmailToken(tokens.refreshToken);
        }
        break;
      }
      case "google-calendar": {
        const tokens = await getGoogleCalendarTokens(
          db,
          organizationId,
          integrationId,
        );
        if (tokens) {
          revoked = await revokeGoogleCalendarToken(tokens.refreshToken);
        }
        break;
      }
      case "linear": {
        const tokens = await getLinearTokens(db, organizationId, integrationId);
        if (tokens) {
          revoked = await revokeLinearToken(tokens.refreshToken);
        }
        break;
      }
      case "salesforce": {
        const tokens = await getSalesforceTokens(
          db,
          organizationId,
          integrationId,
        );
        if (tokens) {
          revoked = await revokeSalesforceRefreshToken(
            externalAccountId,
            tokens.refreshToken,
          );
        }
        break;
      }
      case "xero": {
        const tokens = await getXeroTokens(db, organizationId, integrationId);
        if (tokens) {
          revoked = await revokeXeroRefreshToken(
            getXeroClientCredentials(),
            tokens.refreshToken,
          );
        }
        break;
      }
      case "zendesk": {
        const tokens = await getZendeskTokens(
          db,
          organizationId,
          integrationId,
        );
        if (tokens) {
          revoked = await revokeZendeskAccessToken(
            externalAccountId,
            tokens.accessToken,
          );
        }
        break;
      }
      case "stripe": {
        if (isStripeConfigured()) {
          const origin = (await headers()).get("origin") ?? "";
          const config = getStripeOAuthConfig(origin);
          revoked = await deauthorizeStripeAccount(config, externalAccountId);
        }
        break;
      }
      default:
        break;
    }

    if (revoked === false) {
      logger.log(
        "warn",
        `${sourceSystem} remote token revocation failed during organization deletion; proceeding with local disconnect anyway`,
        {
          operation: "delete_organization.revoke_token",
          connectorSlug: sourceSystem,
          organizationId,
          correlationId: integrationId,
        },
      );
    }
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "delete_organization.revoke_token",
      connectorSlug: sourceSystem,
      organizationId,
      correlationId: integrationId,
    });
  }
}

/**
 * The real "delete my organization" request — see ADR 0018. Order
 * matters: disconnect every real integration (remote OAuth revocation
 * first via `revokeRemoteAccess`, then the Vault-token deletion, one real
 * API/DB call per connector, reusing the exact same tested
 * `disconnectXxxIntegration` functions the /integrations page's own
 * disconnect buttons call) and cancel any active Stripe subscription
 * *before* anonymizing — both need the organization's real, non-anonymized
 * state to still be readable. `anonymizeOrganization` itself deliberately
 * does neither of these; see its own doc comment.
 *
 * Real gap found by review: the `organization.deleted` audit event used to
 * be recorded *before* `anonymizeOrganization`, matching every other real
 * mutation's "record the audit event once the write actually happened"
 * order in direction only — here the write it was supposed to describe
 * hadn't happened yet. `anonymizeOrganization` is a real Postgres call, no
 * more guaranteed to succeed than any other; if it threw, the catch block
 * below correctly reported a failure to the caller, but the audit event
 * asserting `organization.deleted: succeeded` had already durably
 * committed (`recordAuditEvent` is its own separate transaction) and was
 * never rolled back or corrected — a permanent, false record that a
 * GDPR/CCPA-shaped erasure request had completed when it had not. Fixed by
 * recording the event only after anonymization actually succeeds, the same
 * "audit describes a real, already-happened fact" ordering every
 * `disconnect-*.ts` action and billing action already uses. The event's
 * metadata still only reads `activeIntegrations`/`subscription`, both
 * already resolved into local variables before either call — nothing it
 * needs was scrubbed by anonymizing first.
 */
export async function deleteOrganizationAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: DeleteOrganizationState,
): Promise<DeleteOrganizationState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to do this." };
  }

  if (session.role !== "owner") {
    return { error: "Only the owner can delete this organization." };
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `delete-organization:${session.organizationId}`,
    5,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return { error: "Too many attempts. Try again shortly." };
  }

  const db = getPool();

  try {
    const [activeIntegrations, subscription] = await Promise.all([
      listConnectorConnections(db, session.organizationId),
      getOrganizationSubscription(db, session.organizationId),
    ]);

    for (const integration of activeIntegrations) {
      await revokeRemoteAccess(db, session.organizationId, integration);

      const disconnect = DISCONNECT_BY_SOURCE_SYSTEM[integration.sourceSystem];

      if (disconnect) {
        await disconnect(db, session.organizationId, integration.id);
      }
    }

    if (
      subscription?.stripeSubscriptionId &&
      !subscription.cancelAtPeriodEnd &&
      subscription.status !== "canceled" &&
      subscription.status !== "incomplete_expired"
    ) {
      const stripe = createStripeBillingClient(getStripeSecretKey());
      await cancelSubscriptionAtPeriodEnd(
        stripe,
        subscription.stripeSubscriptionId,
      );
    }

    await anonymizeOrganization(db, session.organizationId);

    await recordAuditEvent(db, session.organizationId, {
      userId: session.userId,
      eventType: "organization.deleted",
      subjectType: "organization",
      subjectId: session.organizationId,
      outcome: "succeeded",
      metadata: {
        disconnectedIntegrations: activeIntegrations.map(
          (integration) => integration.sourceSystem,
        ),
        subscriptionCanceled: Boolean(subscription?.stripeSubscriptionId),
      },
    });
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to delete the organization.", {
        organizationId: session.organizationId,
      }),
    };
  }

  // Outside the try/catch deliberately — redirect() throws internally to
  // interrupt rendering, and a catch block above would otherwise treat
  // that as a real failure and swallow the redirect. The organization is
  // now deactivated, so this redirect lands the (now former) owner on the
  // same signed-out experience any other visitor gets.
  redirect("/login?deleted=1");
}
