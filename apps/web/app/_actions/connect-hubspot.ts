"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildHubSpotAuthorizationUrl } from "@business-dashboard/integrations/hubspot";

import {
  getHubSpotOAuthConfig,
  isHubSpotConfigured,
} from "../_lib/hubspot-config";
import { issueOAuthState } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectHubSpotState {
  readonly error: string | null;
}

/**
 * Starts the real HubSpot OAuth flow (ADR 0008). No integration row is
 * created here — external_account_id is protected by the immutable-column
 * trigger (0003), so the row can only be created once the real HubSpot
 * hub id is known, which happens in the callback after a successful
 * exchange. `state` is a real, single-use CSRF nonce (see
 * `oauth-state.ts`), not the organization id — the actual
 * authorization always comes from the callback's own re-derived session,
 * never from this value, but the value itself must still be an
 * unpredictable per-flow secret to serve its CSRF purpose at all.
 */
export async function connectHubSpotAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectHubSpotState,
): Promise<ConnectHubSpotState> {
  if (!isHubSpotConfigured()) {
    return { error: "HubSpot is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect HubSpot." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getHubSpotOAuthConfig(origin);
  const state = await issueOAuthState("hubspot");
  const authorizationUrl = buildHubSpotAuthorizationUrl(config, state);

  redirect(authorizationUrl);
}
