import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

const VERIFIER_TOKEN = "route-test-verifier-token";
process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN = VERIFIER_TOKEN;

const { POST } = await import("./route");

function sign(body: string, token = VERIFIER_TOKEN): string {
  return createHmac("sha256", token).update(body).digest("base64");
}

function requestWithSignature(body: string, signature: string | null): Request {
  const headers = new Headers();
  if (signature !== null) {
    headers.set("intuit-signature", signature);
  }

  return new Request("http://localhost/integrations/quickbooks/webhook", {
    method: "POST",
    headers,
    body,
  });
}

/**
 * The three short-circuit paths — not-configured, missing signature,
 * invalid/tampered signature — plus malformed JSON, all of which return
 * before this route ever reaches `getPool()`/touches the database or
 * calls Intuit's API, so these run without `DATABASE_URL`. A genuine
 * end-to-end duplicate-delivery test (mocking Intuit's Invoice/Payment API
 * responses through `syncQuickBooksInvoices`/`syncQuickBooksPayments`)
 * was deliberately not attempted this pass — that idempotency already has
 * real coverage at the persistence layer (`ingestQuickBooksInvoice`'s
 * `ON CONFLICT (organization_id, idempotency_key) DO NOTHING`,
 * `packages/persistence/tests/invoices.test.ts`), and mocking Intuit's
 * actual API response shape well enough to trust the result adds real
 * risk of a subtly-wrong mock without adding real risk coverage beyond
 * what's already proven there.
 */
describe("QuickBooks webhook route — signature and payload guards", () => {
  it("rejects when the webhook isn't configured", async () => {
    delete process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;

    try {
      const response = await POST(requestWithSignature("{}", "irrelevant"));

      expect(response.status).toBe(503);
    } finally {
      process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN = VERIFIER_TOKEN;
    }
  });

  it("rejects a request with no signature header", async () => {
    const response = await POST(requestWithSignature("{}", null));

    expect(response.status).toBe(400);
  });

  it("rejects a request with an incorrect signature", async () => {
    const body = JSON.stringify({ eventNotifications: [{ realmId: "123" }] });
    const response = await POST(
      requestWithSignature(body, sign(body, "wrong-token")),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a signature for a body that was tampered with after signing", async () => {
    const signedBody = JSON.stringify({
      eventNotifications: [{ realmId: "123" }],
    });
    const signature = sign(signedBody);
    const tamperedBody = JSON.stringify({
      eventNotifications: [{ realmId: "999" }],
    });

    const response = await POST(requestWithSignature(tamperedBody, signature));

    expect(response.status).toBe(400);
  });

  it("rejects a validly-signed but malformed JSON body", async () => {
    const body = "not valid json";

    const response = await POST(requestWithSignature(body, sign(body)));

    expect(response.status).toBe(400);
  });
});

describe.skipIf(!process.env.DATABASE_URL)(
  "QuickBooks webhook route — validated payload with no realms (live database)",
  () => {
    it("acknowledges a validly-signed payload with no realm notifications", async () => {
      const body = JSON.stringify({ eventNotifications: [] });

      const response = await POST(requestWithSignature(body, sign(body)));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: true });
    });
  },
);
