/**
 * Decodes a JWT's payload segment without verifying its signature. Used
 * only where the token comes directly from a provider's own token
 * endpoint response over TLS (never from a client-supplied source) and
 * where nothing in this app makes an authorization decision based on its
 * contents — Google's and Microsoft's id_tokens here are read purely as a
 * per-account dedup key and a display label, never as proof of identity
 * for access control. Shared because both `google-oauth.ts` and
 * `microsoft-oauth.ts` need the identical decode, not because signature
 * verification would ever be skipped where it actually matters.
 */
export function decodeJwtPayload<T>(token: string): T {
  const payloadSegment = token.split(".")[1];

  if (!payloadSegment) {
    throw new Error("JWT is malformed: no payload segment");
  }

  const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(base64, "base64").toString("utf8");
  return JSON.parse(json) as T;
}
