"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildZendeskAuthorizationUrl,
  generatePkcePair,
  isValidZendeskSubdomain,
} from "@signaldesk/integrations/zendesk";

import {
  getZendeskOAuthConfig,
  isZendeskConfigured,
} from "../_lib/zendesk-config";
import {
  issueOAuthState,
  issueOAuthSubdomain,
  issuePkceVerifier,
} from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectZendeskState {
  readonly error: string | null;
}

/**
 * Starts the real Zendesk OAuth 2.0 authorization code flow, including a
 * real PKCE pair (see `@signaldesk/integrations/zendesk`'s client.ts doc
 * comment on why — Zendesk's own current docs explicitly recommend PKCE
 * alongside `client_secret` for a confidential client like this one).
 * Unlike every other connector's connect action, this one also takes real
 * user input — a `subdomain` form field — since Zendesk's authorize/token/
 * API hosts are all subdomain-scoped from the very first request, with no
 * shared, subdomain-agnostic entry point at all (see that same doc
 * comment). The subdomain is stored in a short-lived, single-use cookie
 * (`issueOAuthSubdomain`, mirroring the PKCE verifier cookie's own shape)
 * so the callback can recover it after the redirect round trip. No
 * integration row is created here — only in the callback, once the
 * exchange has actually succeeded.
 */
export async function connectZendeskAction(
  _prevState: ConnectZendeskState,
  formData: FormData,
): Promise<ConnectZendeskState> {
  if (!isZendeskConfigured()) {
    return { error: "Zendesk is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Zendesk." };
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only an owner or admin can connect Zendesk." };
  }

  const subdomain = String(formData.get("subdomain") ?? "").trim();

  if (!subdomain || !isValidZendeskSubdomain(subdomain)) {
    return {
      error:
        'Enter your Zendesk subdomain (the part before .zendesk.com, e.g. "acme").',
    };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getZendeskOAuthConfig(origin, subdomain);
  const state = await issueOAuthState("zendesk");
  await issueOAuthSubdomain("zendesk", subdomain);
  const { verifier, challenge } = generatePkcePair();
  await issuePkceVerifier("zendesk", verifier);
  const authorizationUrl = buildZendeskAuthorizationUrl(
    config,
    state,
    challenge,
  );

  redirect(authorizationUrl);
}
