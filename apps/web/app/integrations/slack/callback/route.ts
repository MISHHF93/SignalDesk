import { NextResponse } from "next/server";

import { exchangeSlackAuthorizationCode } from "@signaldesk/integrations/slack";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateSlackIntegration,
  recordAuditEvent,
  storeSlackTokens,
} from "@signaldesk/persistence";

import { getSlackOAuthConfig } from "../../../_lib/slack-config";
import { consumeOAuthState } from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Slack OAuth v2 flow: stores the bot token in Vault and
 * records the connection. No data sync — unlike HubSpot's deals, there is
 * no existing domain model (leads) Slack channels/messages map onto, so
 * this connector's v1 scope is honestly limited to a real, working OAuth
 * connect/disconnect, matching HubSpot's own v1 scope (ADR 0008) before
 * its sync layer was added. Mirrors the HubSpot callback's structure
 * exactly for everything that generalizes (rate limiting, CSRF, session,
 * audit events).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/slack?slack=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = checkRateLimit(
    `slack-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/slack`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("slack", state);

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
    const config = getSlackOAuthConfig(origin);
    const tokens = await exchangeSlackAuthorizationCode(config, code);

    const integration = await findOrCreateSlackIntegration(
      getPool(),
      session.organizationId,
      tokens.teamId,
      tokens.teamName,
    );

    await storeSlackTokens(getPool(), session.organizationId, integration.id, {
      accessToken: tokens.accessToken,
    });

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "integration.connected",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: {
        sourceSystem: "slack",
        teamId: tokens.teamId,
        teamName: tokens.teamName,
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/slack?slack=connected`,
    );
  } catch (error) {
    console.error("Slack OAuth callback failed", error);
    return redirectTo("error");
  }
}
