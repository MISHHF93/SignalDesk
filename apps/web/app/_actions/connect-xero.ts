"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildXeroAuthorizationUrl } from "@signaldesk/integrations/xero";

import { getXeroOAuthConfig, isXeroConfigured } from "../_lib/xero-config";
import { issueOAuthState } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectXeroState {
  readonly error: string | null;
}

/**
 * Starts the real Xero OAuth 2.0 authorization code flow. No integration
 * row is created here — the row can only be created once the real
 * `tenantId` is known, which happens in the callback after a successful
 * exchange and a real follow-up `/connections` call (Xero, unlike
 * QuickBooks, never discloses which organisation was authorized until
 * that second call — see `fetchXeroConnections`'s doc comment).
 */
export async function connectXeroAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectXeroState,
): Promise<ConnectXeroState> {
  if (!isXeroConfigured()) {
    return { error: "Xero is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Xero." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getXeroOAuthConfig(origin);
  const state = await issueOAuthState("xero");
  const authorizationUrl = buildXeroAuthorizationUrl(config, state);

  redirect(authorizationUrl);
}
