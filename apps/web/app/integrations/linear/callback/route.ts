import { NextResponse } from "next/server";

import {
  exchangeLinearAuthorizationCode,
  fetchLinearViewer,
} from "@signaldesk/integrations/linear";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateLinearIntegration,
  recordAuditEvent,
  storeLinearTokens,
} from "@signaldesk/persistence";

import { getLinearOAuthConfig } from "../../../_lib/linear-config";
import { consumeOAuthState } from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the Linear OAuth flow: exchanges the code, then makes one
 * real extra call to resolve which Linear user connected (Linear's token
 * response carries no identifier at all — see `linear/client.ts`'s doc
 * comment on `fetchLinearViewer`), then stores tokens in Vault. No data
 * sync yet — mirrors the other callbacks' structure otherwise.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/linear?linear=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = checkRateLimit(
    `linear-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/linear`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("linear", state);

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
    const config = getLinearOAuthConfig(origin);
    const tokens = await exchangeLinearAuthorizationCode(config, code);
    const viewer = await fetchLinearViewer(tokens.accessToken);

    const integration = await findOrCreateLinearIntegration(
      getPool(),
      session.organizationId,
      viewer.linearUserId,
      viewer.email,
    );

    await storeLinearTokens(getPool(), session.organizationId, integration.id, {
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
      metadata: { sourceSystem: "linear", linearUserId: viewer.linearUserId },
    });

    return NextResponse.redirect(
      `${origin}/integrations/linear?linear=connected`,
    );
  } catch (error) {
    console.error("Linear OAuth callback failed", error);
    return redirectTo("error");
  }
}
