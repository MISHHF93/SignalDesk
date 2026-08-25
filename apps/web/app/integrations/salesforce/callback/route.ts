import { NextResponse } from "next/server";

import { exchangeSalesforceAuthorizationCode } from "@signaldesk/integrations/salesforce";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateSalesforceIntegration,
  getOrganizationBusinessProfile,
  recordAuditEvent,
  storeSalesforceTokens,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { getSalesforceOAuthConfig } from "../../../_lib/salesforce-config";
import {
  consumeOAuthState,
  consumePkceVerifier,
} from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";
import { syncSalesforceOpportunities } from "../../../_lib/sync-salesforce";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Salesforce OAuth flow and runs a one-time initial sync,
 * mirroring HubSpot's own callback (ADR 0008): stores tokens in Vault,
 * then fetches and ingests every opportunity via
 * `syncSalesforceOpportunities` — the same function "Sync Now"
 * (`_actions/sync-salesforce.ts`) calls later, so the two can never
 * silently drift into different behavior. Recurring/background sync is
 * still explicitly future work; this and "Sync Now" are both synchronous,
 * on-demand runs. The org's `external_account_label` is derived from its
 * real `instance_url` hostname, the one human-readable identifier
 * Salesforce's token response actually provides. Also completes a real
 * PKCE `code_verifier` exchange (see `salesforce/client.ts`'s doc comment
 * for the Salesforce Help source) — fails closed, same as Microsoft
 * Outlook's callback, if either the CSRF `state` or the PKCE verifier is
 * missing.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(
      `${origin}/integrations/salesforce?salesforce=${status}`,
    );

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `salesforce-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(
      `${origin}/login?next=/integrations/salesforce`,
    );
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("salesforce", state);
  const codeVerifier = await consumePkceVerifier("salesforce");

  if (!stateIsValid || !codeVerifier) {
    return redirectTo("error");
  }

  // Real entitlement enforcement: bills by active connections, so a new
  // one is rejected before it's created if the org is already at its
  // plan's limit — checked before the token exchange so a rejected
  // connection doesn't burn the single-use authorization code.
  if (!(await canAddActiveConnection(getPool(), session.organizationId))) {
    return redirectTo("limit");
  }

  try {
    const config = getSalesforceOAuthConfig(origin);
    const tokens = await exchangeSalesforceAuthorizationCode(
      config,
      code,
      codeVerifier,
    );
    const accountLabel = new URL(tokens.instanceUrl).hostname;

    const integration = await findOrCreateSalesforceIntegration(
      getPool(),
      session.organizationId,
      tokens.instanceUrl,
      accountLabel,
    );

    await storeSalesforceTokens(
      getPool(),
      session.organizationId,
      integration.id,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "integration.connected",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: { sourceSystem: "salesforce", instanceUrl: tokens.instanceUrl },
    });

    const businessProfile = await getOrganizationBusinessProfile(
      getPool(),
      session.organizationId,
    );

    let ingested: number;
    let skipped: number;
    let defaultedNameCount: number;

    try {
      ({ ingested, skipped, defaultedNameCount } =
        await syncSalesforceOpportunities(
          getPool(),
          session.organizationId,
          integration.id,
          origin,
          tokens.instanceUrl,
          tokens.accessToken,
          businessProfile.defaultExpectedResponseHours,
          "initial",
        ));
    } catch (syncError) {
      // Authorization already succeeded and was audited above — a sync
      // failure here is a materially different, worth-distinguishing
      // outcome from "never connected," so it gets its own audit event
      // rather than falling into the generic catch below.
      await recordAuditEvent(getPool(), session.organizationId, {
        userId: session.userId,
        eventType: "sync.failed",
        subjectType: "integration",
        subjectId: integration.id,
        outcome: "failed",
        metadata: {
          sourceSystem: "salesforce",
          trigger: "initial",
          error:
            syncError instanceof Error ? syncError.message : String(syncError),
        },
      });
      throw syncError;
    }

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.completed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: {
        sourceSystem: "salesforce",
        opportunitiesIngested: ingested,
        skipped,
        defaultedNameCount,
        trigger: "initial",
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/salesforce?salesforce=connected&synced=${ingested}`,
    );
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "salesforce_oauth_callback.callback",
      connectorSlug: "salesforce",
    });
    return redirectTo("error");
  }
}
