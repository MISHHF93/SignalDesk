import { describe, expect, it } from "vitest";

// @signaldesk/schemas is a devDependency only, used here to prove the
// mapper's output actually satisfies the real runtime boundary schema —
// mirrors quickbooks/mapper.test.ts's own precedent.
import { parseSourceInvoiceRecord } from "@signaldesk/schemas";
import { randomUUID } from "node:crypto";

import {
  detectXeroInvoiceDefaultedFields,
  mapXeroInvoiceToSourceInvoiceRecord,
  parseXeroDate,
} from "./mapper";
import type { XeroInvoice } from "./client";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function invoice(overrides: Partial<XeroInvoice> = {}): XeroInvoice {
  return {
    InvoiceID: "006d0000-example",
    Type: "ACCREC",
    Contact: { ContactID: "contact-1", Name: "Acme Robotics" },
    Total: 1840,
    AmountDue: 1840,
    DueDate: "/Date(1756512000000+0000)/",
    Status: "AUTHORISED",
    UpdatedDateUTC: "/Date(1755526560000+0000)/",
    ...overrides,
  };
}

describe("parseXeroDate", () => {
  it("extracts the real epoch-millisecond value from the legacy .NET wire format", () => {
    const parsed = parseXeroDate("/Date(1756512000000+0000)/");

    expect(parsed.toISOString()).toBe("2025-08-30T00:00:00.000Z");
  });

  it("throws on a genuinely unrecognized format rather than producing an Invalid Date", () => {
    expect(() => parseXeroDate("2026-08-18T14:00:00.000Z")).toThrow(
      /Unrecognized Xero DateTime format/,
    );
  });
});

describe("mapXeroInvoiceToSourceInvoiceRecord", () => {
  it("maps a real-shaped invoice into the source invoice record shape", () => {
    const record = mapXeroInvoiceToSourceInvoiceRecord(
      invoice(),
      NOW,
    ) as Record<string, unknown>;

    expect(record).toMatchObject({
      customerName: "Acme Robotics",
      amountCents: 184_000,
      currency: "USD",
      dueAt: "2025-08-30T00:00:00.000Z",
      status: "open",
      source: {
        system: "xero",
        externalRecordId: "006d0000-example",
        sourceVersion: "2025-08-18T14:16:00.000Z",
        lastSyncedAt: "2026-08-18T14:00:00.000Z",
      },
    });
    expect(typeof record.id).toBe("string");
    expect(
      (record.source as Record<string, unknown>).recordDigestSha256,
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  it("passes real schema validation via parseSourceInvoiceRecord", () => {
    const record = mapXeroInvoiceToSourceInvoiceRecord(invoice(), NOW);

    expect(() =>
      parseSourceInvoiceRecord(record, {
        organizationId: randomUUID(),
        integrationId: randomUUID(),
      }),
    ).not.toThrow();
  });

  it("returns null for an invoice with no due date, not a validation error", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded to build an object without this key, not merely unread
    const { DueDate, ...withoutDueDate } = invoice();

    const record = mapXeroInvoiceToSourceInvoiceRecord(
      withoutDueDate as XeroInvoice,
      NOW,
    );

    expect(record).toBeNull();
  });

  it("returns null for an invoice with a malformed due date rather than throwing", () => {
    const record = mapXeroInvoiceToSourceInvoiceRecord(
      invoice({ DueDate: "not-a-real-date" }),
      NOW,
    );

    expect(record).toBeNull();
  });

  it("falls back to a placeholder customer name when Contact.Name is missing", () => {
    const record = mapXeroInvoiceToSourceInvoiceRecord(
      invoice({ Contact: { ContactID: "contact-9" } }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.customerName).toBe("Xero contact contact-9");
  });

  it("derives amountCents from AmountDue, not Total", () => {
    const record = mapXeroInvoiceToSourceInvoiceRecord(
      invoice({ Total: 5000, AmountDue: 1250 }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.amountCents).toBe(125_000);
  });
});

// Real gap found by review: this mapper already had the same
// silently-defaulted customer-name fallback HubSpot/QuickBooks/Asana's
// mappers do, but never gained the matching audit-visibility companion
// function those three (and Salesforce/Jira/Zendesk) already have —
// mirrors quickbooks/mapper.test.ts's own equivalent coverage.
describe("detectXeroInvoiceDefaultedFields", () => {
  it("reports nothing for a real, complete invoice", () => {
    expect(detectXeroInvoiceDefaultedFields(invoice())).toEqual([]);
  });

  it("flags a missing Contact.Name as defaulted", () => {
    expect(
      detectXeroInvoiceDefaultedFields(
        invoice({ Contact: { ContactID: "contact-9" } }),
      ),
    ).toEqual(["Contact.Name"]);
  });

  it("flags a blank Contact.Name as defaulted, not just a missing one", () => {
    expect(
      detectXeroInvoiceDefaultedFields(
        invoice({ Contact: { ContactID: "contact-9", Name: "   " } }),
      ),
    ).toEqual(["Contact.Name"]);
  });
});
