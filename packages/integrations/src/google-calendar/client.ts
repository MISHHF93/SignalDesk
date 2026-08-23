import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  generatePkcePair,
  GOOGLE_IDENTITY_SCOPES,
  revokeGoogleToken,
  type GoogleOAuthConfig,
  type GoogleTokenResponse,
  type PkcePair,
} from "../shared/google-oauth";

export { generatePkcePair, type PkcePair };

export const GOOGLE_CALENDAR_SCOPES = [
  ...GOOGLE_IDENTITY_SCOPES,
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;

export type GoogleCalendarOAuthConfig = GoogleOAuthConfig;
export type GoogleCalendarTokenResponse = GoogleTokenResponse;

export function buildGoogleCalendarAuthorizationUrl(
  config: Pick<GoogleCalendarOAuthConfig, "clientId" | "redirectUri">,
  state: string,
  codeChallenge: string,
): string {
  return buildGoogleAuthorizationUrl(
    config,
    GOOGLE_CALENDAR_SCOPES,
    state,
    codeChallenge,
  );
}

export const exchangeGoogleCalendarAuthorizationCode =
  exchangeGoogleAuthorizationCode;
export const revokeGoogleCalendarToken = revokeGoogleToken;
