"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildMicrosoftCalendarAuthorizationUrl,
  generatePkcePair,
} from "@signaldesk/integrations/microsoft-calendar";

import {
  getMicrosoftOAuthConfig,
  isMicrosoftConfigured,
} from "../_lib/microsoft-config";
import { issueOAuthState, issuePkceVerifier } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectMicrosoftCalendarState {
  readonly error: string | null;
}

const CALLBACK_PATH = "/integrations/microsoft-calendar/callback";

/**
 * Starts the real Microsoft Calendar OAuth flow, including a real PKCE
 * pair. Mirrors `connectMicrosoftOutlookAction` exactly — a genuinely
 * separate grant from Outlook's even though both share the same
 * `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`.
 */
export async function connectMicrosoftCalendarAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectMicrosoftCalendarState,
): Promise<ConnectMicrosoftCalendarState> {
  if (!isMicrosoftConfigured()) {
    return { error: "Microsoft Calendar is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Microsoft Calendar." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getMicrosoftOAuthConfig(origin, CALLBACK_PATH);
  const state = await issueOAuthState("microsoft-calendar");
  const { verifier, challenge } = generatePkcePair();
  await issuePkceVerifier("microsoft-calendar", verifier);
  const authorizationUrl = buildMicrosoftCalendarAuthorizationUrl(
    config,
    state,
    challenge,
  );

  redirect(authorizationUrl);
}
