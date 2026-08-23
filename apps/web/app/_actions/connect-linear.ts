"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildLinearAuthorizationUrl,
  generatePkcePair,
} from "@signaldesk/integrations/linear";

import {
  getLinearOAuthConfig,
  isLinearConfigured,
} from "../_lib/linear-config";
import { issueOAuthState, issuePkceVerifier } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectLinearState {
  readonly error: string | null;
}

/**
 * Starts the real Linear OAuth flow, including a real PKCE pair (see
 * `@signaldesk/integrations/linear`'s client.ts doc comment on why —
 * Linear's own docs document real PKCE support on this confidential
 * client's exact authorize/token pair). Mirrors
 * `connectMicrosoftOutlookAction`'s structure otherwise.
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
  const { verifier, challenge } = generatePkcePair();
  await issuePkceVerifier("linear", verifier);
  const authorizationUrl = buildLinearAuthorizationUrl(
    config,
    state,
    challenge,
  );

  redirect(authorizationUrl);
}
