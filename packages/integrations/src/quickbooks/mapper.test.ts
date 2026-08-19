import { describe, expect, it } from "vitest";

// @signaldesk/schemas is a devDependency only, used here to prove
// the mapper's output actually satisfies the real runtime boundary schema
// — not just this test file's own assumptions about the shape. Nothing in
// the mapper's own runtime code depends on it (see mapper.ts's doc comment).
import { parseSourceInvoiceRecord } from "@signaldesk/schemas";
import { randomUUID } from "node:crypto";

import { mapQuickBooksInvoiceToSourceInvoiceRecord } from "./mapper";
import type { QuickBooksInvoice } from "./client";

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
      dueAt: "2026-08-01T00:00:00.000Z",
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
