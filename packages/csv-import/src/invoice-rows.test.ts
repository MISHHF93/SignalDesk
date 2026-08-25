import { describe, expect, it } from "vitest";

import { parseInvoiceCsvText } from "./invoice-rows";

const VALID_CSV = `customer_name,amount_cents,currency,due_at,status
Acme Co,250000,USD,2026-08-01,open
Northstar Dental,100000,usd,2026-07-15,paid`;

describe("parseInvoiceCsvText", () => {
  it("parses every valid row with the correct types", () => {
    const result = parseInvoiceCsvText(VALID_CSV);

    if (!result.ok) throw new Error("expected ok result");
    expect(result.validRows).toHaveLength(2);
    expect(result.errors).toEqual([]);
    expect(result.validRows[0]).toMatchObject({
      rowNumber: 2,
      customerName: "Acme Co",
      amountCents: 250_000,
      currency: "USD",
      status: "open",
    });
    // currency is normalized to uppercase regardless of input casing.
    expect(result.validRows[1]?.currency).toBe("USD");
  });

  it("computes a stable content hash for identical rows and a different one for different rows", () => {
    const result = parseInvoiceCsvText(VALID_CSV);
    if (!result.ok) throw new Error("expected ok result");

    const [first, second] = result.validRows;
    expect(first?.contentHash).not.toBe(second?.contentHash);

    const reparsed = parseInvoiceCsvText(VALID_CSV);
    if (!reparsed.ok) throw new Error("expected ok result");
    expect(reparsed.validRows[0]?.contentHash).toBe(first?.contentHash);
  });

  it("fails with a headerError when a required column is missing", () => {
    const result = parseInvoiceCsvText(
      "customer_name,amount_cents,currency,due_at\nAcme,100,USD,2026-08-01",
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected header error");
    expect(result.headerError).toContain("status");
  });

  it("fails with a headerError for an empty file", () => {
    const result = parseInvoiceCsvText("");

    expect(result.ok).toBe(false);
  });

  it("collects a per-row error for a malformed row without discarding the rest of the file", () => {
    const csv = `customer_name,amount_cents,currency,due_at,status
Acme Co,not-a-number,USD,2026-08-01,open
Northstar Dental,100000,USD,2026-07-15,paid`;

    const result = parseInvoiceCsvText(csv);

    if (!result.ok) throw new Error("expected ok result");
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]?.customerName).toBe("Northstar Dental");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.rowNumber).toBe(2);
  });

  it("rejects an invalid status value", () => {
    const csv = `customer_name,amount_cents,currency,due_at,status
Acme Co,100000,USD,2026-08-01,overdue`;

    const result = parseInvoiceCsvText(csv);

    if (!result.ok) throw new Error("expected ok result");
    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a malformed currency code", () => {
    const csv = `customer_name,amount_cents,currency,due_at,status
Acme Co,100000,DOLLARS,2026-08-01,open`;

    const result = parseInvoiceCsvText(csv);

    if (!result.ok) throw new Error("expected ok result");
    expect(result.errors).toHaveLength(1);
  });

  it("rejects an unparsable date", () => {
    const csv = `customer_name,amount_cents,currency,due_at,status
Acme Co,100000,USD,not-a-date,open`;

    const result = parseInvoiceCsvText(csv);

    if (!result.ok) throw new Error("expected ok result");
    expect(result.errors).toHaveLength(1);
  });

  it("accepts headers in any order", () => {
    const csv = `status,due_at,currency,amount_cents,customer_name
open,2026-08-01,USD,100000,Acme Co`;

    const result = parseInvoiceCsvText(csv);

    if (!result.ok) throw new Error("expected ok result");
    expect(result.validRows[0]?.customerName).toBe("Acme Co");
  });

  describe("invoice_number (regression: real invoices silently dropped as false-positive duplicates)", () => {
    it("reports null, not a validation error, when the file has no invoice_number column at all", () => {
      const result = parseInvoiceCsvText(VALID_CSV);

      if (!result.ok) throw new Error("expected ok result");
      expect(result.validRows[0]?.invoiceNumber).toBeNull();
      expect(result.errors).toEqual([]);
    });

    it("reports null, not a validation error, when the column exists but this row's cell is blank", () => {
      const csv = `customer_name,amount_cents,currency,due_at,status,invoice_number
Acme Co,250000,USD,2026-08-01,open,`;

      const result = parseInvoiceCsvText(csv);

      if (!result.ok) throw new Error("expected ok result");
      expect(result.validRows[0]?.invoiceNumber).toBeNull();
      expect(result.errors).toEqual([]);
    });

    it("captures the real value when the column and cell are both present", () => {
      const csv = `customer_name,amount_cents,currency,due_at,status,invoice_number
Acme Co,250000,USD,2026-08-01,open,INV-1042`;

      const result = parseInvoiceCsvText(csv);

      if (!result.ok) throw new Error("expected ok result");
      expect(result.validRows[0]?.invoiceNumber).toBe("INV-1042");
    });

    it("real bug found by review: without invoice_number, two genuinely distinct invoices with identical customer/amount/currency/due date/status hash identically", () => {
      const csv = `customer_name,amount_cents,currency,due_at,status
Acme Co,250000,USD,2026-08-01,open
Acme Co,250000,USD,2026-08-01,open`;

      const result = parseInvoiceCsvText(csv);

      if (!result.ok) throw new Error("expected ok result");
      const [first, second] = result.validRows;
      // Documented, disclosed residual limitation: with no invoice_number
      // column at all, content is the only signal available, so this pair
      // still collides — the second would be silently dropped by
      // ingestCsvInvoice's own idempotency check further downstream.
      expect(first?.contentHash).toBe(second?.contentHash);
    });

    it("fix: the same two otherwise-identical rows hash differently once each has its own invoice_number", () => {
      const csv = `customer_name,amount_cents,currency,due_at,status,invoice_number
Acme Co,250000,USD,2026-08-01,open,INV-1001
Acme Co,250000,USD,2026-08-01,open,INV-1002`;

      const result = parseInvoiceCsvText(csv);

      if (!result.ok) throw new Error("expected ok result");
      const [first, second] = result.validRows;
      expect(first?.contentHash).not.toBe(second?.contentHash);
    });

    it("a genuine re-upload of the same row (same invoice_number too) still hashes identically, preserving real idempotency", () => {
      const csv = `customer_name,amount_cents,currency,due_at,status,invoice_number
Acme Co,250000,USD,2026-08-01,open,INV-1001`;

      const first = parseInvoiceCsvText(csv);
      const second = parseInvoiceCsvText(csv);
      if (!first.ok || !second.ok) throw new Error("expected ok result");

      expect(first.validRows[0]?.contentHash).toBe(
        second.validRows[0]?.contentHash,
      );
    });
  });
});
