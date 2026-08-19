import { describe, expect, it } from "vitest";

import { evaluateOverdueInvoice, type Invoice } from "../src/index";

const dueAt = new Date("2026-08-01T00:00:00.000Z");

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-001",
    organizationId: "org-001",
    customerName: "Northstar Studio",
    amountCents: 250_000,
    currency: "USD",
    dueAt,
    status: "open",
    source: {
      integrationId: "44444444-4444-4444-8444-444444444444",
      system: "quickbooks",
      externalRecordId: "external-invoice-001",
      sourceVersion: "3",
      recordDigestSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
    },
    ...overrides,
  };
}

describe("evaluateOverdueInvoice", () => {
  it("does not surface an invoice before its due date", () => {
    const signal = evaluateOverdueInvoice(
      makeInvoice(),
      new Date("2026-07-31T23:59:59.999Z"),
    );

    expect(signal).toBeNull();
  });

  it("surfaces an invoice exactly on its due date as 0 days overdue", () => {
    const signal = evaluateOverdueInvoice(makeInvoice(), dueAt);

    expect(signal).toEqual({
      id: "invoice.overdue:org-001:invoice-001",
      type: "invoice.overdue",
      invoiceId: "invoice-001",
      organizationId: "org-001",
      severity: "high",
      daysOverdue: 0,
      amountCents: 250_000,
      currency: "USD",
      explanation:
        "Invoice for Northstar Studio is 0 days past its due date and still unpaid.",
      recommendedAction:
        "Follow up with Northstar Studio about the outstanding balance.",
      evidence: [
        {
          integrationId: "44444444-4444-4444-8444-444444444444",
          system: "quickbooks",
          externalRecordId: "external-invoice-001",
          sourceVersion: "3",
          recordDigestSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
        },
      ],
    });
  });

  it("counts whole days overdue past the due date", () => {
    const signal = evaluateOverdueInvoice(
      makeInvoice(),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(signal?.daysOverdue).toBe(14);
    expect(signal?.explanation).toContain("14 days past its due date");
  });

  it("uses singular phrasing for exactly 1 day overdue", () => {
    const signal = evaluateOverdueInvoice(
      makeInvoice(),
      new Date("2026-08-02T00:00:00.000Z"),
    );

    expect(signal?.daysOverdue).toBe(1);
    expect(signal?.explanation).toContain("1 day past its due date");
  });

  it("classifies severity as critical at or above the critical value threshold", () => {
    const signal = evaluateOverdueInvoice(
      makeInvoice({ amountCents: 1_000_000 }),
      new Date("2026-08-05T00:00:00.000Z"),
      1_000_000,
    );

    expect(signal?.severity).toBe("critical");
  });

  it("does not surface a paid invoice even past its due date", () => {
    const signal = evaluateOverdueInvoice(
      makeInvoice({ status: "paid" }),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(signal).toBeNull();
  });

  it("does not surface a void invoice", () => {
    const signal = evaluateOverdueInvoice(
      makeInvoice({ status: "void" }),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(signal).toBeNull();
  });

  it("fails closed for an invalid due date", () => {
    const signal = evaluateOverdueInvoice(
      makeInvoice({ dueAt: new Date("not-a-date") }),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(signal).toBeNull();
  });

  it("fails closed for a negative amount", () => {
    const signal = evaluateOverdueInvoice(
      makeInvoice({ amountCents: -1 }),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(signal).toBeNull();
  });
});
