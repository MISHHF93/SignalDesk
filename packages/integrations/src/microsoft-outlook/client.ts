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

export const MICROSOFT_OUTLOOK_SCOPES = [
  ...MICROSOFT_IDENTITY_SCOPES,
  "https://graph.microsoft.com/Mail.Read",
] as const;

export type MicrosoftOutlookOAuthConfig = MicrosoftOAuthConfig;
export type MicrosoftOutlookTokenResponse = MicrosoftTokenResponse;

export function buildMicrosoftOutlookAuthorizationUrl(
  config: Pick<MicrosoftOutlookOAuthConfig, "clientId" | "redirectUri">,
  state: string,
  codeChallenge: string,
): string {
  return buildMicrosoftAuthorizationUrl(
    config,
    MICROSOFT_OUTLOOK_SCOPES,
    state,
    codeChallenge,
  );
}

export function exchangeMicrosoftOutlookAuthorizationCode(
  config: MicrosoftOutlookOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<MicrosoftOutlookTokenResponse> {
  return exchangeMicrosoftAuthorizationCode(
    config,
    MICROSOFT_OUTLOOK_SCOPES,
    code,
    codeVerifier,
  );
}
