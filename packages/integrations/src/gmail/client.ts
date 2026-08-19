import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  GOOGLE_IDENTITY_SCOPES,
  revokeGoogleToken,
  type GoogleOAuthConfig,
  type GoogleTokenResponse,
} from "../shared/google-oauth";

export const GMAIL_SCOPES = [
  ...GOOGLE_IDENTITY_SCOPES,
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

export type GmailOAuthConfig = GoogleOAuthConfig;
export type GmailTokenResponse = GoogleTokenResponse;

export function buildGmailAuthorizationUrl(
  config: Pick<GmailOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  return buildGoogleAuthorizationUrl(config, GMAIL_SCOPES, state);
}

export const exchangeGmailAuthorizationCode = exchangeGoogleAuthorizationCode;
export const revokeGmailToken = revokeGoogleToken;
