"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildGmailAuthorizationUrl,
  generatePkcePair,
} from "@signaldesk/integrations/gmail";

import {
  getGoogleOAuthConfig,
  isGoogleConfigured,
} from "../_lib/google-config";
import { issueOAuthState, issuePkceVerifier } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectGmailState {
  readonly error: string | null;
}

const CALLBACK_PATH = "/integrations/gmail/callback";

/**
 * Starts the real Gmail OAuth flow, including a real PKCE pair (see
 * `packages/integrations/src/shared/google-oauth.ts`'s doc comment on why
 * this confidential client still uses PKCE). Mirrors `connectHubSpotAction`
 * otherwise — no integration row is created here, only once the real
 * Google account id (the id_token's `sub` claim) is known, in the
 * callback after a successful exchange.
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
  const { verifier, challenge } = generatePkcePair();
  await issuePkceVerifier("gmail", verifier);
  const authorizationUrl = buildGmailAuthorizationUrl(config, state, challenge);

  redirect(authorizationUrl);
}
