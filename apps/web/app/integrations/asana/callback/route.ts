import { NextResponse } from "next/server";

import { exchangeAsanaAuthorizationCode } from "@signaldesk/integrations/asana";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateAsanaIntegration,
  recordAuditEvent,
  storeAsanaTokens,
} from "@signaldesk/persistence";

import { getAsanaOAuthConfig } from "../../../_lib/asana-config";
import { errorReporter } from "../../../_lib/error-reporter";
import {
  consumeOAuthState,
  consumePkceVerifier,
} from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";
import { syncAsanaTasks } from "../../../_lib/sync-asana";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Asana OAuth flow (with a real PKCE `code_verifier` — see
 * `asana/client.ts`'s doc comment on why) and runs a one-time initial
 * sync of overdue, incomplete tasks via `syncAsanaTasks` — the same
 * function "Sync Now" (`_actions/sync-asana.ts`) calls later, so the two
 * can never silently drift into different behavior. Stores tokens in
 * Vault and records which Asana user connected (the token response's own
 * `data.gid`/`data.email` — no separate identity call needed, unlike
 * Linear). Recurring/background sync is still explicitly future work.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/asana?asana=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `asana-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/asana`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("asana", state);
  const codeVerifier = await consumePkceVerifier("asana");

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
    const config = getAsanaOAuthConfig(origin);
    const tokens = await exchangeAsanaAuthorizationCode(
      config,
      code,
      codeVerifier,
    );

    const integration = await findOrCreateAsanaIntegration(
      getPool(),
      session.organizationId,
      tokens.asanaUserId,
      tokens.email,
    );

    await storeAsanaTokens(getPool(), session.organizationId, integration.id, {
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
      metadata: { sourceSystem: "asana", asanaUserId: tokens.asanaUserId },
    });

    let ingested: number;
    let skipped: number;

    try {
      ({ ingested, skipped } = await syncAsanaTasks(
        getPool(),
        session.organizationId,
        integration.id,
        tokens.accessToken,
        tokens.asanaUserId,
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
          sourceSystem: "asana",
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
        sourceSystem: "asana",
        tasksIngested: ingested,
        skipped,
        trigger: "initial",
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/asana?asana=connected&synced=${ingested}`,
    );
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "asana_oauth_callback.callback",
      connectorSlug: "asana",
    });
    return redirectTo("error");
  }
}
