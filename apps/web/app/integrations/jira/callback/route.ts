import { NextResponse } from "next/server";

import {
  exchangeJiraAuthorizationCode,
  fetchJiraAccessibleResources,
} from "@signaldesk/integrations/jira";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateJiraIntegration,
  recordAuditEvent,
  storeJiraTokens,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { getJiraOAuthConfig } from "../../../_lib/jira-config";
import { consumeOAuthState } from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";
import { syncJiraIssues } from "../../../_lib/sync-jira";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Atlassian OAuth 2.0 (3LO) flow and runs a one-time
 * initial sync of open issues via `syncJiraIssues` — the same function
 * "Sync Now" (`_actions/sync-jira.ts`) calls later, so the two can never
 * silently drift into different behavior. Unlike QuickBooks (`realmId`
 * arrives as its own redirect query param), Atlassian discloses which
 * site(s) were authorized only via a real, separate
 * `GET /oauth/token/accessible-resources` call made with the freshly-
 * exchanged access token — see `fetchJiraAccessibleResources`'s doc
 * comment in `@signaldesk/integrations/jira`. Recurring/background sync
 * is still explicitly future work.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/jira?jira=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `jira-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/jira`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("jira", state);

  if (!stateIsValid) {
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
    const config = getJiraOAuthConfig(origin);
    const tokens = await exchangeJiraAuthorizationCode(config, code);
    const resources = await fetchJiraAccessibleResources(tokens.accessToken);
    const resource = resources[0];

    if (!resource) {
      // A real, honest failure mode: the user completed consent but
      // authorized zero sites (or revoked access between consent and this
      // call) — not something a retry of this same code fixes.
      throw new Error("Jira returned no accessible sites.");
    }

    const integration = await findOrCreateJiraIntegration(
      getPool(),
      session.organizationId,
      resource.id,
      resource.name,
    );

    await storeJiraTokens(getPool(), session.organizationId, integration.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    });

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "integration.connected",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: { sourceSystem: "jira", cloudId: resource.id },
    });

    let ingested: number;
    let skipped: number;

    try {
      ({ ingested, skipped } = await syncJiraIssues(
        getPool(),
        session.organizationId,
        integration.id,
        tokens.accessToken,
        resource.id,
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
          sourceSystem: "jira",
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
        sourceSystem: "jira",
        issuesIngested: ingested,
        skipped,
        trigger: "initial",
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/jira?jira=connected&synced=${ingested}`,
    );
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "jira_oauth_callback.callback",
      connectorSlug: "jira",
    });
    return redirectTo("error");
  }
}
