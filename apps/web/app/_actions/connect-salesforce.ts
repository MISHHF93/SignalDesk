"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildSalesforceAuthorizationUrl,
  generatePkcePair,
} from "@signaldesk/integrations/salesforce";

import {
  getSalesforceOAuthConfig,
  isSalesforceConfigured,
} from "../_lib/salesforce-config";
import { issueOAuthState, issuePkceVerifier } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectSalesforceState {
  readonly error: string | null;
}

/**
 * Starts the real Salesforce OAuth 2.0 web server flow, including a real
 * PKCE pair (see `packages/integrations/src/salesforce/client.ts`'s doc
 * comment for the Salesforce Help source confirming PKCE is documented
 * for this exact flow, additive to the consumer secret). No integration
 * row is created here — the row can only be created once the real org
 * `instance_url` is known, which happens in the callback after a
 * successful exchange. `state` is a real, single-use CSRF nonce
 * (`oauth-state.ts`, shared with every other OAuth connector), not a
 * stable value — the actual authorization always comes from the
 * callback's own re-derived session, never from this value.
 */
export async function connectSalesforceAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectSalesforceState,
): Promise<ConnectSalesforceState> {
  if (!isSalesforceConfigured()) {
    return { error: "Salesforce is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Salesforce." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getSalesforceOAuthConfig(origin);
  const state = await issueOAuthState("salesforce");
  const { verifier, challenge } = generatePkcePair();
  await issuePkceVerifier("salesforce", verifier);
  const authorizationUrl = buildSalesforceAuthorizationUrl(
    config,
    state,
    challenge,
  );

  redirect(authorizationUrl);
}
