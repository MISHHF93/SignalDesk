import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

// Long enough for a real human to complete a provider's consent screen,
// short enough to bound how long a captured callback URL stays replayable.
const MAX_AGE_SECONDS = 10 * 60;

function cookieName(providerName: string): string {
  return `${providerName}_oauth_state`;
}

function pkceCookieName(providerName: string): string {
  return `${providerName}_pkce_verifier`;
}

/**
 * A real, single-use, server-stored CSRF nonce for a provider's OAuth flow
 * (RFC 6749 §10.12's `state` guidance), parameterized by provider name so
 * HubSpot and Slack (and any future OAuth connector) share one
 * implementation instead of each re-deriving the same cookie logic —
 * generalized from the HubSpot-only version built earlier this session.
 * Stored httpOnly (never readable by client-side JS) and `sameSite: "lax"`
 * (still sent on the provider's top-level redirect back to this origin).
 */
export async function issueOAuthState(providerName: string): Promise<string> {
  const nonce = randomUUID();
  const cookieStore = await cookies();

  cookieStore.set(cookieName(providerName), nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });

  return nonce;
}

/**
 * Verifies the callback's `state` against the stored nonce and always
 * clears the cookie afterward, regardless of outcome — a captured or
 * replayed callback URL can only ever be consumed once. Defense in depth
 * alongside (not instead of) the callback's own re-derived session check.
 */
export async function consumeOAuthState(
  providerName: string,
  returnedState: string | null,
): Promise<boolean> {
  const cookieStore = await cookies();
  const name = cookieName(providerName);
  const expected = cookieStore.get(name)?.value;

  cookieStore.delete(name);

  return (
    expected !== undefined &&
    returnedState !== null &&
    returnedState === expected
  );
}

/**
 * Same single-use, server-stored, provider-scoped cookie mechanism as
 * `issueOAuthState`/`consumeOAuthState`, holding a PKCE `code_verifier`
 * instead of a CSRF nonce — needed only by Microsoft's connectors today
 * (see `packages/integrations/src/shared/microsoft-oauth.ts`'s doc
 * comment on why PKCE is used even for this confidential client). A
 * separate cookie rather than folding the verifier into the state value:
 * `state` is echoed back in the callback URL and must stay opaque/short,
 * while the verifier never leaves the server until the token exchange.
 */
export async function issuePkceVerifier(
  providerName: string,
  verifier: string,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(pkceCookieName(providerName), verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function consumePkceVerifier(
  providerName: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const name = pkceCookieName(providerName);
  const verifier = cookieStore.get(name)?.value;

  cookieStore.delete(name);

  return verifier ?? null;
}
