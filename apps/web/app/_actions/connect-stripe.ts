"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildStripeAuthorizationUrl } from "@business-dashboard/integrations/stripe";

import {
  getStripeOAuthConfig,
  isStripeConfigured,
} from "../_lib/stripe-config";
import { issueOAuthState } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectStripeState {
  readonly error: string | null;
}

/**
 * Starts the real Stripe Connect OAuth flow. Mirrors
 * `connectHubSpotAction` exactly — no integration row is created here,
 * only once the real connected account id is known, in the callback after
 * a successful exchange.
 */
export async function connectStripeAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectStripeState,
): Promise<ConnectStripeState> {
  if (!isStripeConfigured()) {
    return { error: "Stripe is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Stripe." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getStripeOAuthConfig(origin);
  const state = await issueOAuthState("stripe");
  const authorizationUrl = buildStripeAuthorizationUrl(config, state);

  redirect(authorizationUrl);
}
