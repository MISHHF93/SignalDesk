"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildGmailAuthorizationUrl } from "@business-dashboard/integrations/gmail";

import {
  getGoogleOAuthConfig,
  isGoogleConfigured,
} from "../_lib/google-config";
import { issueOAuthState } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectGmailState {
  readonly error: string | null;
}

const CALLBACK_PATH = "/integrations/gmail/callback";

/**
 * Starts the real Gmail OAuth flow. Mirrors `connectHubSpotAction`
 * exactly — no integration row is created here, only once the real Google
 * account id (the id_token's `sub` claim) is known, in the callback after
 * a successful exchange.
 */
export async function connectGmailAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectGmailState,
): Promise<ConnectGmailState> {
  if (!isGoogleConfigured()) {
    return { error: "Gmail is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Gmail." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getGoogleOAuthConfig(origin, CALLBACK_PATH);
  const state = await issueOAuthState("gmail");
  const authorizationUrl = buildGmailAuthorizationUrl(config, state);

  redirect(authorizationUrl);
}
