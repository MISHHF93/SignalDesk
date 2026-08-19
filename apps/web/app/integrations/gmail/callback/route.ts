import { NextResponse } from "next/server";

import { exchangeGmailAuthorizationCode } from "@business-dashboard/integrations/gmail";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateGmailIntegration,
  recordAuditEvent,
  storeGmailTokens,
} from "@business-dashboard/persistence";

import { getGoogleOAuthConfig } from "../../../_lib/google-config";
import { consumeOAuthState } from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";

const CALLBACK_PATH = "/integrations/gmail/callback";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Gmail OAuth flow: stores tokens in Vault and records which
 * Google account connected. No data sync — like Slack/Stripe/QuickBooks,
 * there is no existing domain model this connector's read yet maps onto,
 * so v1 is honestly limited to a real, working OAuth connect/disconnect.
 * Mirrors the other callbacks' structure exactly for everything that
 * generalizes.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/gmail?gmail=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = checkRateLimit(
    `gmail-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/gmail`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("gmail", state);

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
    const tokens = await exchangeGmailAuthorizationCode(config, code);

    const integration = await findOrCreateGmailIntegration(
      getPool(),
      session.organizationId,
      tokens.googleUserId,
      tokens.email,
    );

    await storeGmailTokens(getPool(), session.organizationId, integration.id, {
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
      metadata: { sourceSystem: "gmail", googleUserId: tokens.googleUserId },
    });

    return NextResponse.redirect(
      `${origin}/integrations/gmail?gmail=connected`,
    );
  } catch (error) {
    console.error("Gmail OAuth callback failed", error);
    return redirectTo("error");
  }
}
