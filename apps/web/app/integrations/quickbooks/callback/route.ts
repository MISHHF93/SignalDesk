import { NextResponse } from "next/server";

import { exchangeQuickBooksAuthorizationCode } from "@signaldesk/integrations/quickbooks";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateQuickBooksIntegration,
  recordAuditEvent,
  storeQuickBooksTokens,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { consumeOAuthState } from "../../../_lib/oauth-state";
import { getQuickBooksOAuthConfig } from "../../../_lib/quickbooks-config";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";
import {
  syncQuickBooksInvoices,
  syncQuickBooksPayments,
} from "../../../_lib/sync-quickbooks";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the QuickBooks Online OAuth flow and runs a one-time initial
 * sync of open, overdue invoices via `syncQuickBooksInvoices` — the same
 * function "Sync Now" (`_actions/sync-quickbooks.ts`) calls later, so the
 * two can never silently drift into different behavior. `realmId` is read
 * directly off this callback's own query string — per Intuit's OAuth flow
 * it never appears in the token response body (see client.ts's doc
 * comment). Recurring/background sync is still explicitly future work.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(
      `${origin}/integrations/quickbooks?quickbooks=${status}`,
    );

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code || !realmId) {
    return redirectTo("error");
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `quickbooks-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(
      `${origin}/login?next=/integrations/quickbooks`,
    );
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("quickbooks", state);

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
    const config = getQuickBooksOAuthConfig(origin);
    const tokens = await exchangeQuickBooksAuthorizationCode(config, code);

    const integration = await findOrCreateQuickBooksIntegration(
      getPool(),
      session.organizationId,
      realmId,
    );

    await storeQuickBooksTokens(
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
      metadata: { sourceSystem: "quickbooks", realmId },
    });

    let ingested: number;
    let skipped: number;
    let paymentsIngested: number;

    try {
      const [invoiceResult, paymentResult] = await Promise.all([
        syncQuickBooksInvoices(
          getPool(),
          session.organizationId,
          integration.id,
          tokens.accessToken,
          realmId,
          "initial",
        ),
        syncQuickBooksPayments(
          getPool(),
          session.organizationId,
          integration.id,
          tokens.accessToken,
          realmId,
          "initial",
        ),
      ]);

      ingested = invoiceResult.ingested;
      skipped = invoiceResult.skipped + paymentResult.skipped;
      paymentsIngested = paymentResult.ingested;
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
          sourceSystem: "quickbooks",
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
        sourceSystem: "quickbooks",
        invoicesIngested: ingested,
        paymentsIngested,
        skipped,
        trigger: "initial",
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/quickbooks?quickbooks=connected&synced=${ingested}`,
    );
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "quickbooks_oauth_callback.callback",
      connectorSlug: "quickbooks",
    });
    return redirectTo("error");
  }
}
