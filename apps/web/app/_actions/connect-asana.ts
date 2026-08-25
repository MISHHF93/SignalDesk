"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildAsanaAuthorizationUrl,
  generatePkcePair,
} from "@signaldesk/integrations/asana";

import { getAsanaOAuthConfig, isAsanaConfigured } from "../_lib/asana-config";
import { issueOAuthState, issuePkceVerifier } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectAsanaState {
  readonly error: string | null;
}

/**
 * Starts the real Asana OAuth flow, including a real PKCE pair (see
 * `@signaldesk/integrations/asana`'s client.ts doc comment on why —
 * Asana's own docs document real PKCE support on this confidential
 * client's exact authorize/token pair). Mirrors
 * `connectMicrosoftOutlookAction`'s structure otherwise.
 */
export async function connectAsanaAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectAsanaState,
): Promise<ConnectAsanaState> {
  if (!isAsanaConfigured()) {
    return { error: "Asana is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Asana." };
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only an owner or admin can connect Asana." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getAsanaOAuthConfig(origin);
  const state = await issueOAuthState("asana");
  const { verifier, challenge } = generatePkcePair();
  await issuePkceVerifier("asana", verifier);
  const authorizationUrl = buildAsanaAuthorizationUrl(config, state, challenge);

  redirect(authorizationUrl);
}
