"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildSlackAuthorizationUrl } from "@signaldesk/integrations/slack";

import { getSlackOAuthConfig, isSlackConfigured } from "../_lib/slack-config";
import { issueOAuthState } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectSlackState {
  readonly error: string | null;
}

/**
 * Starts the real Slack OAuth v2 flow. No integration row is created here
 * — the row can only be created once the real Slack team id is known,
 * which happens in the callback after a successful exchange. `state` is a
 * real, single-use CSRF nonce (`oauth-state.ts`, shared with HubSpot's
 * connect action), not a stable value — the actual authorization always
 * comes from the callback's own re-derived session, never from this value.
 */
export async function connectSlackAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectSlackState,
): Promise<ConnectSlackState> {
  if (!isSlackConfigured()) {
    return { error: "Slack is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Slack." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getSlackOAuthConfig(origin);
  const state = await issueOAuthState("slack");
  const authorizationUrl = buildSlackAuthorizationUrl(config, state);

  redirect(authorizationUrl);
}
