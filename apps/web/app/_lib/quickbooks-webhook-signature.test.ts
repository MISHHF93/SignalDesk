import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyQuickBooksWebhookSignature } from "./quickbooks-webhook-signature";

const VERIFIER_TOKEN = "test-verifier-token";

function sign(body: string, token = VERIFIER_TOKEN): string {
  return createHmac("sha256", token).update(body).digest("base64");
}

describe("verifyQuickBooksWebhookSignature", () => {
  it("accepts a signature computed with the real verifier token", () => {
    const body = JSON.stringify({ eventNotifications: [{ realmId: "123" }] });

    expect(
      verifyQuickBooksWebhookSignature(body, sign(body), VERIFIER_TOKEN),
    ).toBe(true);
  });

  it("rejects a signature computed with the wrong verifier token", () => {
    const body = JSON.stringify({ eventNotifications: [{ realmId: "123" }] });

    expect(
      verifyQuickBooksWebhookSignature(
        body,
        sign(body, "a-different-token"),
        VERIFIER_TOKEN,
      ),
    ).toBe(false);
  });

  it("rejects a signature for a body that was tampered with after signing", () => {
    const originalBody = JSON.stringify({
      eventNotifications: [{ realmId: "123" }],
    });
    const signature = sign(originalBody);
    const tamperedBody = JSON.stringify({
      eventNotifications: [{ realmId: "999" }],
    });

    expect(
      verifyQuickBooksWebhookSignature(tamperedBody, signature, VERIFIER_TOKEN),
    ).toBe(false);
  });

  it("rejects a signature of the wrong length rather than throwing", () => {
    const body = JSON.stringify({ eventNotifications: [] });

    expect(
      verifyQuickBooksWebhookSignature(body, "dG9vLXNob3J0", VERIFIER_TOKEN),
    ).toBe(false);
  });

  it("rejects an empty signature header rather than throwing", () => {
    const body = JSON.stringify({ eventNotifications: [] });

    expect(verifyQuickBooksWebhookSignature(body, "", VERIFIER_TOKEN)).toBe(
      false,
    );
  });
});
