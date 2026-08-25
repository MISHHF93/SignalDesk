import { NextResponse } from "next/server";

import { exchangeStripeAuthorizationCode } from "@signaldesk/integrations/stripe";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateStripeIntegration,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { consumeOAuthState } from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";
import { getStripeOAuthConfig } from "../../../_lib/stripe-config";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Stripe Connect OAuth flow: records which account
 * connected. No token to store (see `stripe-integration.ts`'s doc comment)
 * and no data sync — like Slack, there is no existing domain model
 * (payments/invoices) this connector's read yet maps onto, so v1 is
 * honestly limited to a real, working OAuth connect/disconnect, matching
 * HubSpot's own v1 scope (ADR 0008) before its sync layer was added.
 * Mirrors the HubSpot/Slack callbacks' structure exactly for everything
 * that generalizes (rate limiting, CSRF, session, audit events).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/stripe?stripe=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `stripe-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/stripe`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("stripe", state);

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
    const config = getStripeOAuthConfig(origin);
    const account = await exchangeStripeAuthorizationCode(config, code);

    const integration = await findOrCreateStripeIntegration(
      getPool(),
      session.organizationId,
      account.stripeUserId,
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "integration.connected",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: {
        sourceSystem: "stripe",
        stripeUserId: account.stripeUserId,
        livemode: account.livemode,
      },
    });

    return NextResponse.redirect(
      `${origin}/integrations/stripe?stripe=connected`,
    );
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "stripe_oauth_callback.callback",
      connectorSlug: "stripe",
    });
    return redirectTo("error");
  }
}
