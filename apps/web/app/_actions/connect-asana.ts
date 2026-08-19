"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildAsanaAuthorizationUrl } from "@signaldesk/integrations/asana";

import { getAsanaOAuthConfig, isAsanaConfigured } from "../_lib/asana-config";
import { issueOAuthState } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectAsanaState {
  readonly error: string | null;
}

/**
 * Starts the real Asana OAuth flow. Mirrors `connectHubSpotAction`
 * exactly.
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

  const origin = (await headers()).get("origin") ?? "";
  const config = getAsanaOAuthConfig(origin);
  const state = await issueOAuthState("asana");
  const authorizationUrl = buildAsanaAuthorizationUrl(config, state);

  redirect(authorizationUrl);
}
