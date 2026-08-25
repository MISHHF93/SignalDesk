import { NextResponse } from "next/server";

import { exchangeMicrosoftCalendarAuthorizationCode } from "@signaldesk/integrations/microsoft-calendar";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateMicrosoftCalendarIntegration,
  recordAuditEvent,
  storeMicrosoftCalendarTokens,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { getMicrosoftOAuthConfig } from "../../../_lib/microsoft-config";
import {
  consumeOAuthState,
  consumePkceVerifier,
} from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";

const CALLBACK_PATH = "/integrations/microsoft-calendar/callback";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Microsoft Calendar OAuth flow. Mirrors the Outlook
 * callback's structure exactly, including the real PKCE `code_verifier`
 * exchange.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(
      `${origin}/integrations/microsoft-calendar?microsoft-calendar=${status}`,
    );

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `microsoft-calendar-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(
      `${origin}/login?next=/integrations/microsoft-calendar`,
    );
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("microsoft-calendar", state);
  const codeVerifier = await consumePkceVerifier("microsoft-calendar");

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
    const config = getMicrosoftOAuthConfig(origin, CALLBACK_PATH);
    const tokens = await exchangeMicrosoftCalendarAuthorizationCode(
      config,
      code,
      codeVerifier,
    );

    const integration = await findOrCreateMicrosoftCalendarIntegration(
      getPool(),
      session.organizationId,
      tokens.microsoftUserId,
      tokens.email,
    );

    await storeMicrosoftCalendarTokens(
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
        sourceSystem: "microsoft-calendar",
        microsoftUserId: tokens.microsoftUserId,
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/microsoft-calendar?microsoft-calendar=connected`,
    );
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "microsoft-calendar_oauth_callback.callback",
      connectorSlug: "microsoft-calendar",
    });
    return redirectTo("error");
  }
}
