/**
 * Provider-agnostic RFC 7636 PKCE pair generation — extracted out of
 * `microsoft-oauth.ts` (the first connector to use it) so every other
 * connector's authorization-code flow can generate the same real
 * verifier/challenge pair instead of each reinventing it. Current OAuth
 * guidance (IETF's OAuth 2.0 Security Best Current Practice, RFC 9700)
 * recommends PKCE with S256 for every client type, confidential and
 * public alike, not just the traditionally-scoped "public client"
 * case — the same rationale `microsoft-oauth.ts`'s own doc comment
 * already recorded from Microsoft's current docs.
 */

import { randomBytes, createHash } from "node:crypto";

export interface PkcePair {
  readonly verifier: string;
  readonly challenge: string;
}

/** RFC 7636 code_verifier: 43-128 chars from the unreserved URL charset —
 * base64url of 32 random bytes lands at 43 chars, satisfying that. */
export function generatePkcePair(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
