import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpstreamProviderError } from "../shared/upstream-error";
import {
  buildQuickBooksAuthorizationUrl,
  exchangeQuickBooksAuthorizationCode,
  fetchQuickBooksClosedInvoices,
  fetchQuickBooksInvoices,
  fetchQuickBooksPayments,
  mergeCustomerMemo,
  QUICKBOOKS_SCOPES,
  revokeQuickBooksToken,
  sendQuickBooksInvoiceReminder,
  type QuickBooksOAuthConfig,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CONFIG: QuickBooksOAuthConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  redirectUri: "https://example.test/integrations/quickbooks/callback",
};

describe("buildQuickBooksAuthorizationUrl", () => {
  it("builds a real authorize URL with client id, response_type, scope, redirect uri, and state", () => {
    const url = new URL(buildQuickBooksAuthorizationUrl(CONFIG, "nonce-123"));

    expect(url.origin + url.pathname).toBe(
      "https://appcenter.intuit.com/connect/oauth2",
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("scope")).toBe(QUICKBOOKS_SCOPES.join(" "));
    expect(url.searchParams.get("state")).toBe("nonce-123");
  });
});

describe("exchangeQuickBooksAuthorizationCode", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("maps a successful token response into a QuickBooksTokenResponse and sends Basic auth", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        token_type: "bearer",
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 3600,
        x_refresh_token_expires_in: 8_726_400,
      }),
    );

    const result = await exchangeQuickBooksAuthorizationCode(
      CONFIG,
      "auth-code",
    );

    expect(result).toEqual({
      accessToken: "at-1",
      refreshToken: "rt-1",
      expiresIn: 3600,
      refreshTokenExpiresIn: 8_726_400,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("client-1:secret-1").toString("base64")}`,
    );
  });

  it("throws a safe UpstreamProviderError on a non-2xx response, never leaking the raw response body into the client-visible message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "invalid_grant" }),
    );

    let thrown: unknown;

    try {
      await exchangeQuickBooksAuthorizationCode(CONFIG, "bad-code");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(UpstreamProviderError);
    const error = thrown as UpstreamProviderError;
    // The user-visible message never contains the raw status/body — that
    // was the real bug (found by a deep audit, 2026-08-22): the message
    // used to be shown verbatim in Server Action error UI.
    expect(error.message).not.toContain("400");
    expect(error.message).not.toContain("invalid_grant");
    expect(error.message).toContain("QuickBooks token request failed");
    // The real diagnostic detail is still captured, just not in the
    // client-visible field.
    expect(error.rawDetail).toContain("400");
    expect(error.rawDetail).toContain("invalid_grant");
  });

  it("retries on a 5xx before succeeding, reusing the shared retry policy", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: "unavailable" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          token_type: "bearer",
          access_token: "at-retry",
          refresh_token: "rt-retry",
          expires_in: 3600,
          x_refresh_token_expires_in: 8_726_400,
        }),
      );

    const resultPromise = exchangeQuickBooksAuthorizationCode(
      CONFIG,
      "auth-code",
    );
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.accessToken).toBe("at-retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("revokeQuickBooksToken", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns true on a 200 response and sends the token as a JSON body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    const revoked = await revokeQuickBooksToken(CONFIG, "rt-1");

    expect(revoked).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
    );
    expect(init.body).toBe(JSON.stringify({ token: "rt-1" }));
  });

  it("returns false rather than throwing on an error response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "invalid" }));

    const revokePromise = revokeQuickBooksToken(CONFIG, "rt-bad");
    await vi.runAllTimersAsync();

    expect(await revokePromise).toBe(false);
  });

  it("returns false rather than throwing on a transport failure", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    const revokePromise = revokeQuickBooksToken(CONFIG, "rt-1");
    await vi.runAllTimersAsync();

    expect(await revokePromise).toBe(false);
  });
});

describe("fetchQuickBooksInvoices", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("queries open invoices for the given company with a bearer token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        QueryResponse: {
          Invoice: [
            {
              Id: "148",
              SyncToken: "3",
              TotalAmt: 2500,
              Balance: 2500,
              DueDate: "2026-08-01",
              CustomerRef: { value: "62", name: "Acme Robotics" },
            },
          ],
        },
      }),
    );

    const page = await fetchQuickBooksInvoices(
      "access-token-1",
      "realm-999",
      0,
    );

    expect(page.results).toHaveLength(1);
    expect(page.results[0]?.Id).toBe("148");
    expect(page.hasMore).toBe(false);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.origin + requestUrl.pathname).toBe(
      "https://quickbooks.api.intuit.com/v3/company/realm-999/query",
    );
    expect(requestUrl.searchParams.get("query")).toContain(
      "from Invoice where Balance > '0'",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer access-token-1",
    );
  });

  it("reports hasMore when a full page comes back", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({
      Id: String(index),
      SyncToken: "1",
      TotalAmt: 100,
      Balance: 100,
      DueDate: "2026-08-01",
      CustomerRef: { value: "1" },
    }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { QueryResponse: { Invoice: fullPage } }),
    );

    const page = await fetchQuickBooksInvoices("access-token-1", "realm-1", 0);

    expect(page.hasMore).toBe(true);
  });

  it("returns an empty page when QuickBooks reports no invoices", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { QueryResponse: {} }));

    const page = await fetchQuickBooksInvoices("access-token-1", "realm-1", 0);

    expect(page.results).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  it("throws on a non-ok response after retries are exhausted", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: "server_error" }));

    const resultPromise = fetchQuickBooksInvoices(
      "access-token-1",
      "realm-1",
      0,
    );
    const assertion = expect(resultPromise).rejects.toThrow(
      /QuickBooks invoice query failed/,
    );
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("appends a MetaData.LastUpdatedTime filter when a cursor is passed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { QueryResponse: {} }));

    await fetchQuickBooksInvoices(
      "access-token-1",
      "realm-1",
      0,
      "2026-08-01T00:00:00.000Z",
    );

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const query = new URL(url).searchParams.get("query")!;

    expect(query).toContain(
      "and MetaData.LastUpdatedTime > '2026-08-01T00:00:00.000Z'",
    );
  });

  it("omits the cursor filter when no cursor is passed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { QueryResponse: {} }));

    await fetchQuickBooksInvoices("access-token-1", "realm-1", 0, null);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const query = new URL(url).searchParams.get("query")!;

    expect(query).not.toContain("MetaData.LastUpdatedTime >");
  });
});

describe("fetchQuickBooksClosedInvoices", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queries invoices with a zero balance modified since the cursor", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        QueryResponse: {
          Invoice: [
            {
              Id: "148",
              SyncToken: "4",
              TotalAmt: 2500,
              Balance: 0,
              DueDate: "2026-08-01",
              CustomerRef: { value: "62" },
              MetaData: { LastUpdatedTime: "2026-08-19T00:00:00.000Z" },
            },
          ],
        },
      }),
    );

    const page = await fetchQuickBooksClosedInvoices(
      "access-token-1",
      "realm-1",
      0,
      "2026-08-01T00:00:00.000Z",
    );

    expect(page.results).toHaveLength(1);
    expect(page.results[0]?.Id).toBe("148");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const query = new URL(url).searchParams.get("query")!;

    expect(query).toContain("from Invoice where Balance = '0'");
    expect(query).toContain(
      "and MetaData.LastUpdatedTime > '2026-08-01T00:00:00.000Z'",
    );
  });
});

describe("fetchQuickBooksPayments", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queries payments for the given company with a bearer token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        QueryResponse: {
          Payment: [
            {
              Id: "88",
              SyncToken: "0",
              TotalAmt: 1500,
              TxnDate: "2026-08-18",
              CustomerRef: { value: "62", name: "Acme Robotics" },
              MetaData: { LastUpdatedTime: "2026-08-18T00:00:00.000Z" },
              Line: [
                {
                  LinkedTxn: [{ TxnId: "148", TxnType: "Invoice" }],
                },
              ],
            },
          ],
        },
      }),
    );

    const page = await fetchQuickBooksPayments(
      "access-token-1",
      "realm-999",
      0,
    );

    expect(page.results).toHaveLength(1);
    expect(page.results[0]?.Id).toBe("88");
    expect(page.hasMore).toBe(false);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.origin + requestUrl.pathname).toBe(
      "https://quickbooks.api.intuit.com/v3/company/realm-999/query",
    );
    expect(requestUrl.searchParams.get("query")).toContain("from Payment");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer access-token-1",
    );
  });

  it("appends a MetaData.LastUpdatedTime filter when a cursor is passed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { QueryResponse: {} }));

    await fetchQuickBooksPayments(
      "access-token-1",
      "realm-1",
      0,
      "2026-08-01T00:00:00.000Z",
    );

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const query = new URL(url).searchParams.get("query")!;

    expect(query).toContain(
      "where MetaData.LastUpdatedTime > '2026-08-01T00:00:00.000Z'",
    );
  });

  it("returns an empty page when QuickBooks reports no payments", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { QueryResponse: {} }));

    const page = await fetchQuickBooksPayments("access-token-1", "realm-1", 0);

    expect(page.results).toEqual([]);
    expect(page.hasMore).toBe(false);
  });
});

describe("mergeCustomerMemo", () => {
  it("wraps the reminder body alone when there is no existing memo", () => {
    const result = mergeCustomerMemo(
      undefined,
      "Your invoice for $500 is 10 days overdue.",
    );

    expect(result).toContain("Your invoice for $500 is 10 days overdue.");
  });

  it("preserves a human-authored note that predates any automated reminder", () => {
    const humanNote =
      "Please reach out to accounting@acme.test with any questions.";
    const result = mergeCustomerMemo(
      humanNote,
      "Your invoice for $500 is 10 days overdue.",
    );

    expect(result).toContain(humanNote);
    expect(result).toContain("Your invoice for $500 is 10 days overdue.");
    // The human-authored note must come first — this is what lets the next
    // reminder find and preserve it again, rather than treating it as part
    // of a prior automated reminder.
    expect(result.indexOf(humanNote)).toBeLessThan(
      result.indexOf("Your invoice for $500 is 10 days overdue."),
    );
  });

  it("replaces only the previous reminder text on a later reminder, keeping a human-authored note intact", () => {
    const humanNote = "Thanks for being a loyal customer — call anytime.";
    const afterFirstReminder = mergeCustomerMemo(
      humanNote,
      "Your invoice for $500 is 10 days overdue.",
    );
    const afterSecondReminder = mergeCustomerMemo(
      afterFirstReminder,
      "Second notice: your $500 balance is now 30 days overdue.",
    );

    expect(afterSecondReminder).toContain(humanNote);
    expect(afterSecondReminder).toContain(
      "Second notice: your $500 balance is now 30 days overdue.",
    );
    expect(afterSecondReminder).not.toContain(
      "Your invoice for $500 is 10 days overdue.",
    );
    // The human note must appear exactly once — proof this doesn't
    // duplicate it on every reminder.
    expect(afterSecondReminder.indexOf(humanNote)).toBe(
      afterSecondReminder.lastIndexOf(humanNote),
    );
  });
});

describe("sendQuickBooksInvoiceReminder", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("regression: preserves a human-authored CustomerMemo instead of silently overwriting it", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          Invoice: {
            Id: "148",
            SyncToken: "3",
            CustomerMemo: { value: "Thanks for being a loyal customer!" },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(200, {}));

    await sendQuickBooksInvoiceReminder("access-token-1", "realm-999", "148", {
      body: "Your invoice for $500 is 10 days overdue.",
    });

    const [, updateInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const updateBody = JSON.parse(updateInit.body as string) as {
      CustomerMemo: { value: string };
      SyncToken: string;
      sparse: boolean;
    };

    expect(updateBody.CustomerMemo.value).toContain(
      "Thanks for being a loyal customer!",
    );
    expect(updateBody.CustomerMemo.value).toContain(
      "Your invoice for $500 is 10 days overdue.",
    );
    expect(updateBody.SyncToken).toBe("3");
    expect(updateBody.sparse).toBe(true);
  });

  it("sends only the drafted reminder when the invoice has no pre-existing memo", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { Invoice: { Id: "148", SyncToken: "3" } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(200, {}));

    await sendQuickBooksInvoiceReminder("access-token-1", "realm-999", "148", {
      body: "Your invoice for $500 is 10 days overdue.",
    });

    const [, updateInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const updateBody = JSON.parse(updateInit.body as string) as {
      CustomerMemo: { value: string };
    };

    expect(updateBody.CustomerMemo.value).toContain(
      "Your invoice for $500 is 10 days overdue.",
    );
  });

  it("throws when the invoice lookup finds no invoice", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await expect(
      sendQuickBooksInvoiceReminder("access-token-1", "realm-999", "148", {
        body: "Your invoice for $500 is 10 days overdue.",
      }),
    ).rejects.toThrow(/was not found/);
  });

  it("triggers the real send with a bearer token and no request body", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { Invoice: { Id: "148", SyncToken: "3" } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(200, {}));

    await sendQuickBooksInvoiceReminder("access-token-1", "realm-999", "148", {
      body: "Your invoice for $500 is 10 days overdue.",
    });

    const [sendUrl, sendInit] = fetchMock.mock.calls[2] as [
      string,
      RequestInit,
    ];
    expect(new URL(sendUrl).pathname).toBe(
      "/v3/company/realm-999/invoice/148/send",
    );
    expect(sendInit.method).toBe("POST");
    expect(sendInit.body).toBeUndefined();
    expect((sendInit.headers as Record<string, string>).Authorization).toBe(
      "Bearer access-token-1",
    );
  });

  it("regression: never auto-retries a 5xx on the memo update, since it is not idempotent", async () => {
    // Real bug found by review: fetchWithRetry's blanket retry-on-5xx
    // policy used to apply here unchanged, but a 5xx is not proof the
    // sparse update never applied server-side — retrying would resend the
    // now-stale SyncToken regardless. The memo update now opts out via
    // `{ retryable: false }`.
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { Invoice: { Id: "148", SyncToken: "3" } }),
      )
      .mockResolvedValueOnce(jsonResponse(503, { error: "unavailable" }));

    await expect(
      sendQuickBooksInvoiceReminder("access-token-1", "realm-999", "148", {
        body: "Your invoice for $500 is 10 days overdue.",
      }),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("regression: never auto-retries a 5xx on the send step, since triggering an email is not idempotent", async () => {
    // Same real bug as the memo-update case above, applied to the actual
    // customer-facing email trigger — the highest-stakes of the three
    // steps, since a retry here risks a real duplicate email.
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { Invoice: { Id: "148", SyncToken: "3" } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(503, { error: "unavailable" }));

    await expect(
      sendQuickBooksInvoiceReminder("access-token-1", "realm-999", "148", {
        body: "Your invoice for $500 is 10 days overdue.",
      }),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
