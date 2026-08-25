import { describe, expect, it } from "vitest";

// @signaldesk/schemas is a devDependency only, used here to prove
// the mapper's output actually satisfies the real runtime boundary schema
// — not just this test file's own assumptions about the shape. Nothing in
// the mapper's own runtime code depends on it (see mapper.ts's doc comment).
import {
  parseSourceInvoiceRecord,
  parseSourcePaymentRecord,
} from "@signaldesk/schemas";
import { randomUUID } from "node:crypto";

import {
  detectQuickBooksInvoiceDefaultedFields,
  detectQuickBooksPaymentDefaultedFields,
  mapQuickBooksInvoiceToSourceInvoiceRecord,
  mapQuickBooksPaymentToSourcePaymentRecord,
} from "./mapper";
import type { QuickBooksInvoice, QuickBooksPayment } from "./client";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function invoice(
  overrides: Partial<QuickBooksInvoice> = {},
): QuickBooksInvoice {
  return {
    Id: "148",
    SyncToken: "3",
    TotalAmt: 2500,
    Balance: 2500,
    DueDate: "2026-08-01",
    CustomerRef: { value: "62", name: "Acme Robotics" },
    MetaData: { LastUpdatedTime: "2026-08-17T09:30:00.000-07:00" },
    ...overrides,
  };
}

describe("mapQuickBooksInvoiceToSourceInvoiceRecord", () => {
  it("maps a real-shaped invoice into the source invoice record shape", () => {
    const record = mapQuickBooksInvoiceToSourceInvoiceRecord(
      invoice(),
      NOW,
    ) as Record<string, unknown>;

    expect(record).toMatchObject({
      customerName: "Acme Robotics",
      amountCents: 250_000,
      currency: "USD",
      dueAt: "2026-08-02T11:59:59.999Z",
      status: "open",
      source: {
        system: "quickbooks",
        externalRecordId: "148",
        sourceVersion: "3",
        lastSyncedAt: "2026-08-18T14:00:00.000Z",
      },
    });
    expect(typeof record.id).toBe("string");
    expect(
      (record.source as Record<string, unknown>).recordDigestSha256,
    ).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns null for an invoice with no due date set", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded to build an object without this key, not merely unread
    const { DueDate, ...withoutDueDate } = invoice();
    const record = mapQuickBooksInvoiceToSourceInvoiceRecord(
      withoutDueDate as QuickBooksInvoice,
      NOW,
    );

    expect(record).toBeNull();
  });

  it("falls back to a generic customer name when CustomerRef has no name", () => {
    const record = mapQuickBooksInvoiceToSourceInvoiceRecord(
      invoice({ CustomerRef: { value: "62" } }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.customerName).toBe("QuickBooks customer 62");
  });

  it("detectQuickBooksInvoiceDefaultedFields reports nothing for a real, complete invoice", () => {
    expect(detectQuickBooksInvoiceDefaultedFields(invoice())).toEqual([]);
  });

  it("detectQuickBooksInvoiceDefaultedFields flags a missing CustomerRef.name as defaulted", () => {
    expect(
      detectQuickBooksInvoiceDefaultedFields(
        invoice({ CustomerRef: { value: "62" } }),
      ),
    ).toEqual(["CustomerRef.name"]);
    expect(
      detectQuickBooksInvoiceDefaultedFields(
        invoice({ CustomerRef: { value: "62", name: "  " } }),
      ),
    ).toEqual(["CustomerRef.name"]);
  });

  it("rounds the balance to whole cents", () => {
    const record = mapQuickBooksInvoiceToSourceInvoiceRecord(
      invoice({ Balance: 19.999 }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.amountCents).toBe(2000);
  });

  it("satisfies the real sourceInvoiceRecordSchema boundary, not just this test's assumptions", () => {
    const record = mapQuickBooksInvoiceToSourceInvoiceRecord(invoice(), NOW);

    const parsed = parseSourceInvoiceRecord(record, {
      organizationId: randomUUID(),
      integrationId: randomUUID(),
    });

    expect(parsed.customerName).toBe("Acme Robotics");
    expect(parsed.amountCents).toBe(250_000);
    expect(parsed.status).toBe("open");
  });

  it("produces a different digest for a different invoice payload", () => {
    const a = mapQuickBooksInvoiceToSourceInvoiceRecord(
      invoice(),
      NOW,
    ) as Record<string, unknown>;
    const b = mapQuickBooksInvoiceToSourceInvoiceRecord(
      invoice({ Balance: 9999 }),
      NOW,
    ) as Record<string, unknown>;

    const digestA = (a.source as Record<string, unknown>).recordDigestSha256;
    const digestB = (b.source as Record<string, unknown>).recordDigestSha256;
    expect(digestA).not.toBe(digestB);
  });
});

function payment(
  overrides: Partial<QuickBooksPayment> = {},
): QuickBooksPayment {
  return {
    Id: "88",
    SyncToken: "0",
    TotalAmt: 1500,
    TxnDate: "2026-08-18",
    CustomerRef: { value: "62", name: "Acme Robotics" },
    MetaData: { LastUpdatedTime: "2026-08-18T09:00:00.000-07:00" },
    Line: [{ Amount: 1500, LinkedTxn: [{ TxnId: "148", TxnType: "Invoice" }] }],
    ...overrides,
  };
}

describe("mapQuickBooksPaymentToSourcePaymentRecord", () => {
  it("maps a real-shaped payment into the source payment record shape", () => {
    const record = mapQuickBooksPaymentToSourcePaymentRecord(
      payment(),
      NOW,
    ) as Record<string, unknown>;

    expect(record).toMatchObject({
      customerName: "Acme Robotics",
      amountCents: 150_000,
      currency: "USD",
      receivedAt: "2026-08-19T11:59:59.999Z",
      invoiceAllocations: [{ externalInvoiceId: "148", amountCents: 150_000 }],
      source: {
        system: "quickbooks",
        externalRecordId: "88",
        sourceVersion: "0",
        lastSyncedAt: "2026-08-18T14:00:00.000Z",
      },
    });
    expect(typeof record.id).toBe("string");
  });

  it("falls back to a generic customer name when CustomerRef has no name", () => {
    const record = mapQuickBooksPaymentToSourcePaymentRecord(
      payment({ CustomerRef: { value: "62" } }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.customerName).toBe("QuickBooks customer 62");
  });

  it("detectQuickBooksPaymentDefaultedFields reports nothing for a real, complete payment", () => {
    expect(detectQuickBooksPaymentDefaultedFields(payment())).toEqual([]);
  });

  it("detectQuickBooksPaymentDefaultedFields flags a missing CustomerRef.name as defaulted", () => {
    expect(
      detectQuickBooksPaymentDefaultedFields(
        payment({ CustomerRef: { value: "62" } }),
      ),
    ).toEqual(["CustomerRef.name"]);
  });

  it("extracts only Invoice-typed linked transactions", () => {
    const record = mapQuickBooksPaymentToSourcePaymentRecord(
      payment({
        Line: [
          {
            Amount: 1500,
            LinkedTxn: [
              { TxnId: "148", TxnType: "Invoice" },
              { TxnId: "9", TxnType: "CreditMemo" },
            ],
          },
        ],
      }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.invoiceAllocations).toEqual([
      { externalInvoiceId: "148", amountCents: 150_000 },
    ]);
  });

  it("returns an empty allocation list for an unapplied payment", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded to build an object without this key, not merely unread
    const { Line, ...withoutLine } = payment();
    const record = mapQuickBooksPaymentToSourcePaymentRecord(
      withoutLine as QuickBooksPayment,
      NOW,
    ) as Record<string, unknown>;

    expect(record.invoiceAllocations).toEqual([]);
  });

  it("gives each invoice its own real allocated amount for a bulk payment, never the payment's full total repeated", () => {
    const record = mapQuickBooksPaymentToSourcePaymentRecord(
      payment({
        TotalAmt: 900,
        Line: [
          { Amount: 350, LinkedTxn: [{ TxnId: "148", TxnType: "Invoice" }] },
          { Amount: 550, LinkedTxn: [{ TxnId: "149", TxnType: "Invoice" }] },
        ],
      }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.invoiceAllocations).toEqual([
      { externalInvoiceId: "148", amountCents: 35_000 },
      { externalInvoiceId: "149", amountCents: 55_000 },
    ]);
  });

  it("splits a single line's amount evenly across an unusual multi-invoice link, rather than repeating it for each", () => {
    const record = mapQuickBooksPaymentToSourcePaymentRecord(
      payment({
        Line: [
          {
            Amount: 100,
            LinkedTxn: [
              { TxnId: "148", TxnType: "Invoice" },
              { TxnId: "149", TxnType: "Invoice" },
            ],
          },
        ],
      }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.invoiceAllocations).toEqual([
      { externalInvoiceId: "148", amountCents: 5_000 },
      { externalInvoiceId: "149", amountCents: 5_000 },
    ]);
  });

  it("satisfies the real sourcePaymentRecordSchema boundary, not just this test's assumptions", () => {
    const record = mapQuickBooksPaymentToSourcePaymentRecord(payment(), NOW);

    const parsed = parseSourcePaymentRecord(record, {
      organizationId: randomUUID(),
      integrationId: randomUUID(),
    });

    expect(parsed.customerName).toBe("Acme Robotics");
    expect(parsed.amountCents).toBe(150_000);
    expect(parsed.invoiceAllocations).toEqual([
      { externalInvoiceId: "148", amountCents: 150_000 },
    ]);
  });
});
