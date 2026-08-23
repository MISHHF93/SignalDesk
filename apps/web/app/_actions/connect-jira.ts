"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildJiraAuthorizationUrl } from "@signaldesk/integrations/jira";

import { getJiraOAuthConfig, isJiraConfigured } from "../_lib/jira-config";
import { issueOAuthState } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";

export interface ConnectJiraState {
  readonly error: string | null;
}

/**
 * Starts the real Atlassian OAuth 2.0 (3LO) authorization code flow. No
 * integration row is created here — the row can only be created once the
 * real `cloudId` is known, which happens in the callback after a
 * successful exchange and a real follow-up `/accessible-resources` call
 * (Atlassian, like Xero, never discloses which site was authorized until
 * that second call — see `fetchJiraAccessibleResources`'s doc comment).
 */
export async function connectJiraAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires this parameter
  _prevState: ConnectJiraState,
): Promise<ConnectJiraState> {
  if (!isJiraConfigured()) {
    return { error: "Jira is not yet connected." };
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to connect Jira." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const config = getJiraOAuthConfig(origin);
  const state = await issueOAuthState("jira");
  const authorizationUrl = buildJiraAuthorizationUrl(config, state);

  redirect(authorizationUrl);
}
