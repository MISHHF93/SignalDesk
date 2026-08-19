import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  GOOGLE_IDENTITY_SCOPES,
  revokeGoogleToken,
  type GoogleOAuthConfig,
  type GoogleTokenResponse,
} from "../shared/google-oauth";

export const GOOGLE_CALENDAR_SCOPES = [
  ...GOOGLE_IDENTITY_SCOPES,
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;

export type GoogleCalendarOAuthConfig = GoogleOAuthConfig;
export type GoogleCalendarTokenResponse = GoogleTokenResponse;

export function buildGoogleCalendarAuthorizationUrl(
  config: Pick<GoogleCalendarOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  return buildGoogleAuthorizationUrl(config, GOOGLE_CALENDAR_SCOPES, state);
}

export const exchangeGoogleCalendarAuthorizationCode =
  exchangeGoogleAuthorizationCode;
export const revokeGoogleCalendarToken = revokeGoogleToken;
