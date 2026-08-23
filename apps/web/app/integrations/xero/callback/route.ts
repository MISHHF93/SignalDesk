import { NextResponse } from "next/server";

import {
  exchangeXeroAuthorizationCode,
  fetchXeroConnections,
} from "@signaldesk/integrations/xero";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateXeroIntegration,
  recordAuditEvent,
  storeXeroTokens,
} from "@signaldesk/persistence";

import { consumeOAuthState } from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";
import { syncXeroInvoices } from "../../../_lib/sync-xero";
import { getXeroOAuthConfig } from "../../../_lib/xero-config";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Xero OAuth flow and runs a one-time initial sync of open
 * invoices via `syncXeroInvoices` — the same function "Sync Now"
 * (`_actions/sync-xero.ts`) calls later, so the two can never silently
 * drift into different behavior. Unlike QuickBooks (`realmId` arrives as
 * its own redirect query param), Xero discloses which organisation(s)
 * were authorized only via a real, separate `GET /connections` call made
 * with the freshly-exchanged access token — see `fetchXeroConnections`'s
 * doc comment in `@signaldesk/integrations/xero`. Recurring/background
 * sync is still explicitly future work.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/xero?xero=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `xero-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/xero`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("xero", state);

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
    const config = getXeroOAuthConfig(origin);
    const tokens = await exchangeXeroAuthorizationCode(config, code);
    const connections = await fetchXeroConnections(tokens.accessToken);
    const connection = connections[0];

    if (!connection) {
      // A real, honest failure mode: the user completed consent but
      // authorized zero organisations (or revoked access between consent
      // and this call) — not something a retry of this same code fixes.
      throw new Error("Xero returned no authorized organisations.");
    }

    const integration = await findOrCreateXeroIntegration(
      getPool(),
      session.organizationId,
      connection.tenantId,
      connection.tenantName,
    );

    await storeXeroTokens(getPool(), session.organizationId, integration.id, {
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
      metadata: { sourceSystem: "xero", tenantId: connection.tenantId },
    });

    let ingested: number;
    let skipped: number;
    let closed: number;

    try {
      ({ ingested, skipped, closed } = await syncXeroInvoices(
        getPool(),
        session.organizationId,
        integration.id,
        tokens.accessToken,
        connection.tenantId,
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
          sourceSystem: "xero",
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
        sourceSystem: "xero",
        invoicesIngested: ingested,
        skipped,
        closed,
        trigger: "initial",
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/xero?xero=connected&synced=${ingested}`,
    );
  } catch (error) {
    console.error("Xero OAuth callback failed", error);
    return redirectTo("error");
  }
}
