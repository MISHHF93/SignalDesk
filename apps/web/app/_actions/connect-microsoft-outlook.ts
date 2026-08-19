"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildMicrosoftOutlookAuthorizationUrl,
  generatePkcePair,
} from "@business-dashboard/integrations/microsoft-outlook";

import {
  getMicrosoftOAuthConfig,
  isMicrosoftConfigured,
} from "../_lib/microsoft-config";
import { issueOAuthState, issuePkceVerifier } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectMicrosoftOutlookState {
  readonly error: string | null;
}

const CALLBACK_PATH = "/integrations/microsoft-outlook/callback";

/**
 * Starts the real Microsoft Outlook OAuth flow, including a real PKCE pair
 * (see `packages/integrations/src/shared/microsoft-oauth.ts`'s doc
 * comment on why this confidential client still uses PKCE). Mirrors
 * `connectGmailAction`'s structure otherwise.
 */
export async function connectMicrosoftOutlookAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectMicrosoftOutlookState,
): Promise<ConnectMicrosoftOutlookState> {
  if (!isMicrosoftConfigured()) {
    return { error: "Outlook is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Outlook." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getMicrosoftOAuthConfig(origin, CALLBACK_PATH);
  const state = await issueOAuthState("microsoft-outlook");
  const { verifier, challenge } = generatePkcePair();
  await issuePkceVerifier("microsoft-outlook", verifier);
  const authorizationUrl = buildMicrosoftOutlookAuthorizationUrl(
    config,
    state,
    challenge,
  );

  redirect(authorizationUrl);
}
