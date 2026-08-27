import { describe, expect, it } from "vitest";

const CRON_SECRET = "route-test-cron-secret";
process.env.CRON_SECRET = CRON_SECRET;

const { GET } = await import("./route");

function requestWithAuth(authorization: string | null): Request {
  const headers = new Headers();
  if (authorization !== null) {
    headers.set("authorization", authorization);
  }

  return new Request("http://localhost/api/cron/quickbooks-reconciliation", {
    headers,
  });
}

/**
 * Only the short-circuit guard paths — unauthorized, not configured —
 * both of which return before this route ever lists an integration or
 * touches QuickBooks. A real end-to-end run was deliberately not
 * attempted here, live database or otherwise: unlike the webhook route's
 * own "no realms" test (which controls its exact input via the request
 * body), this route enumerates every active QuickBooks integration
 * already in the database — in the real shared dev project that means
 * whatever other tests/sessions happened to leave behind, several of
 * which carry no real, live-decryptable Vault token. Exercising the full
 * run against that live, uncontrolled state means either a real,
 * slow network call to Intuit per stale fixture (this was tried and
 * timed out — the exact anti-pattern the webhook route's own test file
 * already warns against: real risk from an external call with no real
 * coverage gained) or asserting nothing genuinely useful about this
 * route's own logic. The real, controllable logic this route adds
 * (which integrations get selected, in what order) is already covered
 * where it belongs: `listQuickBooksIntegrationsNeedingReconciliation`'s
 * own live-database tests in `scheduled-jobs.test.ts`.
 */
describe("QuickBooks reconciliation cron — auth and config guards", () => {
  it("rejects a request with no authorization header", async () => {
    const response = await GET(requestWithAuth(null) as never);

    expect(response.status).toBe(401);
  });

  it("rejects a request with the wrong bearer token", async () => {
    const response = await GET(requestWithAuth("Bearer wrong-secret") as never);

    expect(response.status).toBe(401);
  });

  it("rejects when CRON_SECRET itself is unset", async () => {
    delete process.env.CRON_SECRET;

    try {
      const response = await GET(
        requestWithAuth(`Bearer ${CRON_SECRET}`) as never,
      );

      expect(response.status).toBe(401);
    } finally {
      process.env.CRON_SECRET = CRON_SECRET;
    }
  });

  it("reports QuickBooks as not configured when no client credentials are set", async () => {
    delete process.env.QUICKBOOKS_CLIENT_ID;
    delete process.env.QUICKBOOKS_CLIENT_SECRET;

    const response = await GET(
      requestWithAuth(`Bearer ${CRON_SECRET}`) as never,
    );

    expect(response.status).toBe(503);
  });
});
