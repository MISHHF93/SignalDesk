import { NextResponse } from "next/server";

import { exchangeZendeskAuthorizationCode } from "@signaldesk/integrations/zendesk";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateZendeskIntegration,
  recordAuditEvent,
  storeZendeskTokens,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { getZendeskOAuthConfig } from "../../../_lib/zendesk-config";
import {
  consumeOAuthState,
  consumeOAuthSubdomain,
  consumePkceVerifier,
} from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";
import { syncZendeskTickets } from "../../../_lib/sync-zendesk";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Zendesk OAuth 2.0 authorization code flow — including a
 * real PKCE `code_verifier` exchange (see `@signaldesk/integrations/
 * zendesk`'s client.ts doc comment on why this confidential client still
 * sends one) — and runs a one-time initial sync of tickets via
 * `syncZendeskTickets` — the same function "Sync Now"
 * (`_actions/sync-zendesk.ts`) calls later, so the two can never silently
 * drift into different behavior. Unlike every other connector's callback,
 * there is no post-token-exchange discovery call here at all: the
 * subdomain was already real user input at connect time, recovered from
 * the short-lived cookie `connect-zendesk.ts` set (`consumeOAuthSubdomain`,
 * mirroring the PKCE verifier's own recovery pattern) — see
 * `zendesk-config.ts`'s own doc comment.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/zendesk?zendesk=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `zendesk-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/zendesk`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("zendesk", state);
  const subdomain = await consumeOAuthSubdomain("zendesk");
  const codeVerifier = await consumePkceVerifier("zendesk");

  if (!stateIsValid || !subdomain || !codeVerifier) {
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
    const config = getZendeskOAuthConfig(origin, subdomain);
    const tokens = await exchangeZendeskAuthorizationCode(
      config,
      code,
      codeVerifier,
    );

    const integration = await findOrCreateZendeskIntegration(
      getPool(),
      session.organizationId,
      subdomain,
    );

    await storeZendeskTokens(
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
      metadata: { sourceSystem: "zendesk", subdomain },
    });

    let ingested: number;
    let skipped: number;

    try {
      ({ ingested, skipped } = await syncZendeskTickets(
        getPool(),
        session.organizationId,
        integration.id,
        tokens.accessToken,
        subdomain,
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
          sourceSystem: "zendesk",
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
        sourceSystem: "zendesk",
        ticketsIngested: ingested,
        skipped,
        trigger: "initial",
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/zendesk?zendesk=connected&synced=${ingested}`,
    );
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "zendesk_oauth_callback.callback",
      connectorSlug: "zendesk",
    });
    return redirectTo("error");
  }
}
