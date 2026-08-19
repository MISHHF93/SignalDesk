import {
  buildMicrosoftAuthorizationUrl,
  exchangeMicrosoftAuthorizationCode,
  generatePkcePair,
  MICROSOFT_IDENTITY_SCOPES,
  type MicrosoftOAuthConfig,
  type MicrosoftTokenResponse,
  type PkcePair,
} from "../shared/microsoft-oauth";

export { generatePkcePair, type PkcePair };

export const MICROSOFT_CALENDAR_SCOPES = [
  ...MICROSOFT_IDENTITY_SCOPES,
  "https://graph.microsoft.com/Calendars.Read",
] as const;

export type MicrosoftCalendarOAuthConfig = MicrosoftOAuthConfig;
export type MicrosoftCalendarTokenResponse = MicrosoftTokenResponse;

export function buildMicrosoftCalendarAuthorizationUrl(
  config: Pick<MicrosoftCalendarOAuthConfig, "clientId" | "redirectUri">,
  state: string,
  codeChallenge: string,
): string {
  return buildMicrosoftAuthorizationUrl(
    config,
    MICROSOFT_CALENDAR_SCOPES,
    state,
    codeChallenge,
  );
}

export function exchangeMicrosoftCalendarAuthorizationCode(
  config: MicrosoftCalendarOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<MicrosoftCalendarTokenResponse> {
  return exchangeMicrosoftAuthorizationCode(
    config,
    MICROSOFT_CALENDAR_SCOPES,
    code,
    codeVerifier,
  );
}
