import { timingSafeEqual } from "node:crypto";

/**
 * Verifies a cron route's `Authorization: Bearer {CRON_SECRET}` header —
 * extracted into its own module so all 3 cron routes (`morning-brief`,
 * `billing-reconciliation`, `quickbooks-reconciliation`) share one real
 * implementation instead of 3 independently-copied checks that could
 * silently drift, and so it's directly unit-testable the same reason
 * `quickbooks-webhook-signature.ts`'s own doc comment gives.
 *
 * Real gap found by review: the 3 call sites this replaces each used a
 * plain `!==` string comparison — a real (if narrow) timing side channel
 * on a secret this codebase already treats as sensitive elsewhere
 * (`quickbooks-webhook-signature.ts`'s own HMAC check uses
 * `timingSafeEqual` for exactly this reason). Fails closed on any
 * length mismatch before the constant-time compare, matching that same
 * file's own reasoning: a length mismatch is itself proof of a wrong
 * value, so short-circuiting on it leaks nothing `timingSafeEqual`
 * itself wouldn't already leak by throwing on mismatched lengths.
 */
export function verifyCronSecret(
  authHeader: string | null,
  cronSecret: string | undefined,
): boolean {
  if (!cronSecret || !authHeader) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const received = Buffer.from(authHeader);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}
