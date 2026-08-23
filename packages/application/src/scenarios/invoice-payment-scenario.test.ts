import type { Invoice } from "@signaldesk/domain";
import { describe, expect, it } from "vitest";

import { simulateInvoicePaymentScenario } from "./invoice-payment-scenario";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    organizationId: "org-1",
    customerName: "Acme Robotics",
    amountCents: 100_000,
    currency: "USD",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
    status: "open",
    source: {
      integrationId: "integration-1",
      system: "quickbooks",
      externalRecordId: "ext-1",
      sourceVersion: "1",
      recordDigestSha256: "a".repeat(64),
      lastSyncedAt: new Date("2026-08-18T00:00:00.000Z"),
    },
    ...overrides,
  };
}

describe("simulateInvoicePaymentScenario", () => {
  it("labels the result as a simulation", () => {
    const result = simulateInvoicePaymentScenario([], []);

    expect(result.label).toBe("SIMULATION");
  });

  it("returns an empty baseline and scenario for no overdue invoices", () => {
    const result = simulateInvoicePaymentScenario([], []);

    expect(result.baseline).toEqual([]);
    expect(result.scenario).toEqual([]);
  });

  it("computes the baseline exposure across all overdue invoices, grouped by currency", () => {
    const invoices = [
      invoice({ id: "inv-1", amountCents: 100_000, currency: "USD" }),
      invoice({ id: "inv-2", amountCents: 50_000, currency: "USD" }),
      invoice({ id: "inv-3", amountCents: 20_000, currency: "CAD" }),
    ];

    const result = simulateInvoicePaymentScenario(invoices, []);

    expect(result.baseline).toEqual([
      { currency: "CAD", count: 1, amountCents: 20_000 },
      { currency: "USD", count: 2, amountCents: 150_000 },
    ]);
  });

  it("removes an assumed-paid invoice from the scenario exposure but not the baseline", () => {
    const invoices = [
      invoice({ id: "inv-1", amountCents: 100_000, currency: "USD" }),
      invoice({ id: "inv-2", amountCents: 50_000, currency: "USD" }),
    ];

    const result = simulateInvoicePaymentScenario(invoices, ["inv-1"]);

    expect(result.baseline).toEqual([
      { currency: "USD", count: 2, amountCents: 150_000 },
    ]);
    expect(result.scenario).toEqual([
      { currency: "USD", count: 1, amountCents: 50_000 },
    ]);
    expect(result.assumedPaidInvoiceIds).toEqual(["inv-1"]);
  });

  it("never mutates the input invoices", () => {
    const invoices = [invoice({ id: "inv-1" })];
    const originalInvoices = [...invoices];

    simulateInvoicePaymentScenario(invoices, ["inv-1"]);

    expect(invoices).toEqual(originalInvoices);
  });

  it("drops a currency entirely from the scenario when its only invoice is paid off", () => {
    const invoices = [
      invoice({ id: "inv-1", currency: "CAD", amountCents: 20_000 }),
    ];

    const result = simulateInvoicePaymentScenario(invoices, ["inv-1"]);

    expect(result.scenario).toEqual([]);
  });

  it("ignores an assumed-paid id that doesn't match any overdue invoice", () => {
    const invoices = [invoice({ id: "inv-1", amountCents: 100_000 })];

    const result = simulateInvoicePaymentScenario(invoices, [
      "not-a-real-invoice",
    ]);

    expect(result.scenario).toEqual(result.baseline);
  });
});
