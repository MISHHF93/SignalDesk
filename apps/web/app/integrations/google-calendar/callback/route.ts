import { NextResponse } from "next/server";

import { exchangeGoogleCalendarAuthorizationCode } from "@signaldesk/integrations/google-calendar";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateGoogleCalendarIntegration,
  recordAuditEvent,
  storeGoogleCalendarTokens,
} from "@signaldesk/persistence";

import { getGoogleOAuthConfig } from "../../../_lib/google-config";
import { consumeOAuthState } from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";

const CALLBACK_PATH = "/integrations/google-calendar/callback";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Google Calendar OAuth flow: stores tokens in Vault and
 * records which Google account connected. No data sync yet — mirrors the
 * other callbacks' structure exactly.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(
      `${origin}/integrations/google-calendar?google-calendar=${status}`,
    );

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = checkRateLimit(
    `google-calendar-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(
      `${origin}/login?next=/integrations/google-calendar`,
    );
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("google-calendar", state);

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
    const config = getGoogleOAuthConfig(origin, CALLBACK_PATH);
    const tokens = await exchangeGoogleCalendarAuthorizationCode(config, code);

    const integration = await findOrCreateGoogleCalendarIntegration(
      getPool(),
      session.organizationId,
      tokens.googleUserId,
      tokens.email,
    );

    await storeGoogleCalendarTokens(
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
      metadata: {
        sourceSystem: "google-calendar",
        googleUserId: tokens.googleUserId,
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/google-calendar?google-calendar=connected`,
    );
  } catch (error) {
    console.error("Google Calendar OAuth callback failed", error);
    return redirectTo("error");
  }
}
