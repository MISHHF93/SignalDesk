"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildGoogleCalendarAuthorizationUrl } from "@business-dashboard/integrations/google-calendar";

import {
  getGoogleOAuthConfig,
  isGoogleConfigured,
} from "../_lib/google-config";
import { issueOAuthState } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectGoogleCalendarState {
  readonly error: string | null;
}

const CALLBACK_PATH = "/integrations/google-calendar/callback";

/**
 * Starts the real Google Calendar OAuth flow. Mirrors `connectGmailAction`
 * exactly — a genuinely separate grant from Gmail's even though both share
 * the same `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (see
 * app/_lib/google-config.ts's doc comment).
 */
export async function connectGoogleCalendarAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectGoogleCalendarState,
): Promise<ConnectGoogleCalendarState> {
  if (!isGoogleConfigured()) {
    return { error: "Google Calendar is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Google Calendar." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getGoogleOAuthConfig(origin, CALLBACK_PATH);
  const state = await issueOAuthState("google-calendar");
  const authorizationUrl = buildGoogleCalendarAuthorizationUrl(config, state);

  redirect(authorizationUrl);
}
