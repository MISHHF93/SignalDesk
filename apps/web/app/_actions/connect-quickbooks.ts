"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildQuickBooksAuthorizationUrl } from "@signaldesk/integrations/quickbooks";

import { issueOAuthState } from "../_lib/oauth-state";
import {
  getQuickBooksOAuthConfig,
  isQuickBooksConfigured,
} from "../_lib/quickbooks-config";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectQuickBooksState {
  readonly error: string | null;
}

/**
 * Starts the real QuickBooks Online OAuth flow. Mirrors
 * `connectHubSpotAction` exactly — no integration row is created here,
 * only once the real realmId is known, in the callback after a successful
 * redirect (realmId arrives as its own callback query param, not from the
 * token exchange — see the client's doc comment).
 */
export async function connectQuickBooksAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectQuickBooksState,
): Promise<ConnectQuickBooksState> {
  if (!isQuickBooksConfigured()) {
    return { error: "QuickBooks is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect QuickBooks." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getQuickBooksOAuthConfig(origin);
  const state = await issueOAuthState("quickbooks");
  const authorizationUrl = buildQuickBooksAuthorizationUrl(config, state);

  redirect(authorizationUrl);
}
