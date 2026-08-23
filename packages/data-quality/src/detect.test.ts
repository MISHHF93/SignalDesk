import type { Invoice, Lead, SourceReference } from "@signaldesk/domain";
import { describe, expect, it } from "vitest";

import { detectInvoiceLeadNameDuplicates } from "./detect";

const NOW = new Date("2026-08-20T12:00:00.000Z");

function source(overrides: Partial<SourceReference> = {}): SourceReference {
  return {
    integrationId: "integration-1",
    system: "quickbooks",
    externalRecordId: "ext-1",
    sourceVersion: "1",
    recordDigestSha256: "a".repeat(64),
    lastSyncedAt: NOW,
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    organizationId: "org-1",
    customerName: "Acme Co",
    amountCents: 100_000,
    currency: "USD",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
    status: "open",
    source: source({ system: "quickbooks", externalRecordId: "qb-invoice-1" }),
    ...overrides,
  };
}

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    organizationId: "org-1",
    contactName: "Jane Doe",
    companyName: "Acme Co",
    valueCents: 500_000,
    currency: "USD",
    owner: null,
    stage: "negotiation",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    lastInteractionAt: null,
    expectedResponseHours: 24,
    source: source({ system: "hubspot", externalRecordId: "hs-lead-1" }),
    ...overrides,
  };
}

describe("detectInvoiceLeadNameDuplicates", () => {
  it("flags an invoice customer name and lead company name that match across different source systems", () => {
    const issues = detectInvoiceLeadNameDuplicates([invoice()], [lead()], NOW);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: "POTENTIAL_DUPLICATE_ENTITY",
      matchedOn: "Acme Co",
      entities: [
        { kind: "invoice", id: "invoice-1", system: "quickbooks" },
        { kind: "lead", id: "lead-1", system: "hubspot" },
      ],
      detectedAt: NOW,
    });
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    const issues = detectInvoiceLeadNameDuplicates(
      [invoice({ customerName: "  ACME CO  " })],
      [lead({ companyName: "acme co" })],
      NOW,
    );

    expect(issues).toHaveLength(1);
  });

  it("never flags a pair from the same source system", () => {
    const issues = detectInvoiceLeadNameDuplicates(
      [invoice({ source: source({ system: "hubspot" }) })],
      [lead({ source: source({ system: "hubspot" }) })],
      NOW,
    );

    expect(issues).toEqual([]);
  });

  it("returns [] when names don't match — never a fuzzy guess", () => {
    const issues = detectInvoiceLeadNameDuplicates(
      [invoice({ customerName: "Acme Corp" })],
      [lead({ companyName: "Acme Co" })],
      NOW,
    );

    expect(issues).toEqual([]);
  });

  it("skips an invoice with a blank customer name", () => {
    const issues = detectInvoiceLeadNameDuplicates(
      [invoice({ customerName: "   " })],
      [lead({ companyName: "   " })],
      NOW,
    );

    expect(issues).toEqual([]);
  });

  it("flags every matching lead when more than one exists", () => {
    const issues = detectInvoiceLeadNameDuplicates(
      [invoice()],
      [
        lead({ id: "lead-1", source: source({ system: "hubspot" }) }),
        lead({ id: "lead-2", source: source({ system: "salesforce" }) }),
      ],
      NOW,
    );

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.entities[1].id).sort()).toEqual([
      "lead-1",
      "lead-2",
    ]);
  });
});
