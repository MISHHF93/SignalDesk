import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("@signaldesk/csv-import");
vi.mock("@signaldesk/persistence");

import { parseInvoiceCsvText } from "@signaldesk/csv-import";

import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { previewCsvInvoiceImportAction } from "./preview-csv-invoice-import";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedParseInvoiceCsvText = vi.mocked(parseInvoiceCsvText);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

/**
 * Dry-run only: writes nothing, ever — this action has no persistence
 * mock to assert "not called" against because it genuinely calls no
 * write function at all (see the source file's own doc comment).
 */
describe("previewCsvInvoiceImportAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await previewCsvInvoiceImportAction("csv text");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 65,
    });

    const result = await previewCsvInvoiceImportAction("csv text");

    expect(result).toEqual({
      ok: false,
      error: "Please wait 2 more minute(s) before previewing again.",
    });
    expect(mockedParseInvoiceCsvText).not.toHaveBeenCalled();
  });

  it("refuses a file larger than the size cap without ever parsing it", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    const oversized = "a".repeat(2_000_001);

    const result = await previewCsvInvoiceImportAction(oversized);

    expect(result).toEqual({
      ok: false,
      error: "File is too large to preview.",
    });
    expect(mockedParseInvoiceCsvText).not.toHaveBeenCalled();
  });

  it("returns the real header error when the file's header is malformed", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedParseInvoiceCsvText.mockReturnValue({
      ok: false,
      headerError: "Missing required column: currency.",
    });

    const result = await previewCsvInvoiceImportAction("bad,header");

    expect(result).toEqual({
      ok: false,
      error: "Missing required column: currency.",
    });
  });

  it("returns valid row count and row errors on the happy path, without writing anything", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedParseInvoiceCsvText.mockReturnValue({
      ok: true,
      validRows: [
        {
          rowNumber: 2,
          customerName: "Acme",
          amountCents: 1000,
          currency: "USD",
          dueAt: new Date(),
          status: "open",
          invoiceNumber: null,
          contentHash: "hash-1",
        },
      ],
      errors: [{ rowNumber: 3, message: "invalid amount_cents" }],
    });

    const result = await previewCsvInvoiceImportAction("csv text");

    expect(result).toEqual({
      ok: true,
      validRowCount: 1,
      errors: [{ rowNumber: 3, message: "invalid amount_cents" }],
    });
  });

  it("returns a description of the failure when parsing itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedParseInvoiceCsvText.mockImplementation(() => {
      throw new Error("unexpected parser error");
    });

    const result = await previewCsvInvoiceImportAction("csv text");

    expect(result).toEqual({
      ok: false,
      error: "unexpected parser error",
    });
  });
});
