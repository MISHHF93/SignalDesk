import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a QuickBooks webhook's `intuit-signature` header — extracted
 * out of `integrations/quickbooks/webhook/route.ts` into its own module
 * so it's directly unit-testable: a Next.js App Router `route.ts` file may
 * only export the specific handler names Next.js recognizes (`GET`,
 * `POST`, etc.), so this couldn't stay there as an additional named export
 * without risking a build-time route-export error.
 */
export function verifyQuickBooksWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  verifierToken: string,
): boolean {
  const expected = createHmac("sha256", verifierToken)
    .update(rawBody)
    .digest("base64");

  const expectedBuffer = Buffer.from(expected, "base64");
  const receivedBuffer = Buffer.from(signatureHeader, "base64");

  // timingSafeEqual throws on unequal-length buffers rather than
  // returning false — a length mismatch is itself proof the signature is
  // wrong, so it's safe to short-circuit before the constant-time compare.
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
