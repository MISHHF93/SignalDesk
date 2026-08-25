import { NextResponse } from "next/server";

import { exchangeGmailAuthorizationCode } from "@signaldesk/integrations/gmail";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateGmailIntegration,
  recordAuditEvent,
  storeGmailTokens,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { getGoogleOAuthConfig } from "../../../_lib/google-config";
import {
  consumeOAuthState,
  consumePkceVerifier,
} from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";
import { syncGmailMessages } from "../../../_lib/sync-gmail";

const CALLBACK_PATH = "/integrations/gmail/callback";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Gmail OAuth flow: stores tokens in Vault, records which
 * Google account connected, and runs a real one-time initial message sync
 * (Phase 4b, implementation roadmap — extends past this route's original
 * "OAuth only, no domain model to sync onto yet" scope now that `messages`
 * is a real canonical entity). Mirrors HubSpot's callback exactly: a sync
 * failure here is audited distinctly from a connect failure, since
 * authorization already genuinely succeeded by that point. Also mirrors
 * Microsoft Outlook's callback in consuming a real PKCE `code_verifier`
 * (see `google-oauth.ts`'s doc comment on why).
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

  const rateLimit = await checkRateLimit(
    getPool(),
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
  const codeVerifier = await consumePkceVerifier("gmail");

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
    const config = getGoogleOAuthConfig(origin, CALLBACK_PATH);
    const tokens = await exchangeGmailAuthorizationCode(
      config,
      code,
      codeVerifier,
    );

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

    if (!tokens.email) {
      // Real, disclosed edge case: no email claim came back on the
      // id_token (should not happen given the always-requested `email`
      // scope, but honestly handled rather than assumed) — connection
      // still succeeds, sync is simply skipped rather than guessing which
      // account is "us."
      return NextResponse.redirect(
        `${origin}/integrations/gmail?gmail=connected`,
      );
    }

    let ingested: number;
    let filtered: number;
    let skipped: number;

    try {
      ({ ingested, filtered, skipped } = await syncGmailMessages(
        getPool(),
        session.organizationId,
        integration.id,
        tokens.accessToken,
        tokens.email,
        "initial",
      ));
    } catch (syncError) {
      // Authorization already succeeded and was audited above — a sync
      // failure here is a materially different, worth-distinguishing
      // outcome from "never connected," so it gets its own audit event
      // before rethrowing to the outer catch (same precedent as
      // HubSpot's callback) rather than silently reporting "connected"
      // when the initial sync actually failed.
      await recordAuditEvent(getPool(), session.organizationId, {
        userId: session.userId,
        eventType: "sync.failed",
        subjectType: "integration",
        subjectId: integration.id,
        outcome: "failed",
        metadata: {
          sourceSystem: "gmail",
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
        sourceSystem: "gmail",
        messagesIngested: ingested,
        filtered,
        skipped,
        trigger: "initial",
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/gmail?gmail=connected&synced=${ingested}`,
    );
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "gmail_oauth_callback.callback",
      connectorSlug: "gmail",
    });
    return redirectTo("error");
  }
}
