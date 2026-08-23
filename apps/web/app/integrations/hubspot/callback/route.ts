import { NextResponse } from "next/server";

import { exchangeHubSpotAuthorizationCode } from "@signaldesk/integrations/hubspot";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateHubSpotIntegration,
  getOrganizationBusinessProfile,
  recordAuditEvent,
  storeHubSpotTokens,
} from "@signaldesk/persistence";

import { getHubSpotOAuthConfig } from "../../../_lib/hubspot-config";
import { consumeOAuthState } from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";
import { syncHubSpotDeals } from "../../../_lib/sync-hubspot";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the HubSpot OAuth flow and runs a one-time initial sync
 * (ADR 0008): stores tokens in Vault, then fetches and ingests every open
 * deal via `syncHubSpotDeals` — the same function "Sync Now"
 * (`_actions/sync-hubspot.ts`) calls later, so the two can never silently
 * drift into different behavior. Recurring/background sync is still
 * explicitly future work; this and "Sync Now" are both synchronous,
 * on-demand runs.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/hubspot?hubspot=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `hubspot-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/hubspot`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone. This is layered with, not a
  // substitute for, the real authorization being this re-derived session.
  const stateIsValid = await consumeOAuthState("hubspot", state);

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
    const config = getHubSpotOAuthConfig(origin);
    const tokens = await exchangeHubSpotAuthorizationCode(config, code);

    const integration = await findOrCreateHubSpotIntegration(
      getPool(),
      session.organizationId,
      tokens.hubId,
    );

    await storeHubSpotTokens(
      getPool(),
      session.organizationId,
      integration.id,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "integration.connected",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: { sourceSystem: "hubspot", hubId: tokens.hubId },
    });

    const businessProfile = await getOrganizationBusinessProfile(
      getPool(),
      session.organizationId,
    );

    let ingested: number;
    let skipped: number;
    let defaultedNameCount: number;

    try {
      ({ ingested, skipped, defaultedNameCount } = await syncHubSpotDeals(
        getPool(),
        session.organizationId,
        integration.id,
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
          sourceSystem: "hubspot",
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
        sourceSystem: "hubspot",
        dealsIngested: ingested,
        skipped,
        defaultedNameCount,
        trigger: "initial",
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/hubspot?hubspot=connected&synced=${ingested}`,
    );
  } catch (error) {
    console.error("HubSpot OAuth callback failed", error);
    return redirectTo("error");
  }
}
