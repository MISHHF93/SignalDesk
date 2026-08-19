"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildLinearAuthorizationUrl } from "@business-dashboard/integrations/linear";

import {
  getLinearOAuthConfig,
  isLinearConfigured,
} from "../_lib/linear-config";
import { issueOAuthState } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectLinearState {
  readonly error: string | null;
}

/**
 * Starts the real Linear OAuth flow. Mirrors `connectHubSpotAction`
 * exactly.
 */
export async function connectLinearAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectLinearState,
): Promise<ConnectLinearState> {
  if (!isLinearConfigured()) {
    return { error: "Linear is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Linear." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getLinearOAuthConfig(origin);
  const state = await issueOAuthState("linear");
  const authorizationUrl = buildLinearAuthorizationUrl(config, state);

  redirect(authorizationUrl);
}
