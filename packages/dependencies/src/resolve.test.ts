import type { Invoice, Payment, SourceReference } from "@signaldesk/domain";
import { describe, expect, it } from "vitest";

import {
  findDependenciesForInvoice,
  resolvePaymentInvoiceDependencies,
} from "./resolve";

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
    source: source({ externalRecordId: "qb-invoice-1" }),
    ...overrides,
  };
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    organizationId: "org-1",
    customerName: "Acme Co",
    amountCents: 40_000,
    currency: "USD",
    receivedAt: new Date("2026-08-15T00:00:00.000Z"),
    invoiceAllocations: [
      { externalInvoiceId: "qb-invoice-1", amountCents: 40_000 },
    ],
    source: source({ externalRecordId: "qb-payment-1" }),
    ...overrides,
  };
}

describe("resolvePaymentInvoiceDependencies", () => {
  it("resolves a payment's external invoice reference to a real internal invoice id", () => {
    const dependencies = resolvePaymentInvoiceDependencies(
      [payment()],
      [invoice()],
    );

    expect(dependencies).toHaveLength(1);
    expect(dependencies[0]).toMatchObject({
      type: "payment_settles_invoice",
      confidence: "CONFIRMED_DEPENDENCY",
      from: { kind: "payment", id: "payment-1" },
      to: { kind: "invoice", id: "invoice-1" },
      amountCents: 40_000,
      currency: "USD",
    });
  });

  it("returns [] when the payment carries no linked invoice references", () => {
    const dependencies = resolvePaymentInvoiceDependencies(
      [payment({ invoiceAllocations: [] })],
      [invoice()],
    );

    expect(dependencies).toEqual([]);
  });

  it("returns [] when no invoice matches the external id — never a guessed match", () => {
    const dependencies = resolvePaymentInvoiceDependencies(
      [
        payment({
          invoiceAllocations: [
            {
              externalInvoiceId: "qb-invoice-does-not-exist",
              amountCents: 40_000,
            },
          ],
        }),
      ],
      [invoice()],
    );

    expect(dependencies).toEqual([]);
  });

  it("never matches across different source systems", () => {
    const dependencies = resolvePaymentInvoiceDependencies(
      [
        payment({
          source: source({
            system: "stripe",
            externalRecordId: "st-payment-1",
          }),
        }),
      ],
      [
        invoice({
          source: source({
            system: "quickbooks",
            externalRecordId: "qb-invoice-1",
          }),
        }),
      ],
    );

    expect(dependencies).toEqual([]);
  });

  it("resolves a bulk payment against every invoice it settles, with each invoice's own allocated amount", () => {
    const dependencies = resolvePaymentInvoiceDependencies(
      [
        payment({
          amountCents: 40_000,
          invoiceAllocations: [
            { externalInvoiceId: "qb-invoice-1", amountCents: 15_000 },
            { externalInvoiceId: "qb-invoice-2", amountCents: 25_000 },
          ],
        }),
      ],
      [
        invoice({
          id: "invoice-1",
          source: source({ externalRecordId: "qb-invoice-1" }),
        }),
        invoice({
          id: "invoice-2",
          source: source({ externalRecordId: "qb-invoice-2" }),
        }),
      ],
    );

    expect(dependencies).toHaveLength(2);
    expect(
      dependencies.find((dependency) => dependency.to.id === "invoice-1")
        ?.amountCents,
    ).toBe(15_000);
    expect(
      dependencies.find((dependency) => dependency.to.id === "invoice-2")
        ?.amountCents,
    ).toBe(25_000);
    // Neither invoice's dependency claims the payment's full $40,000 total
    // — the real over-attribution bug this allocation-aware resolution
    // replaced (each invoice used to independently claim the whole
    // payment amount).
    expect(
      dependencies.every((dependency) => dependency.amountCents !== 40_000),
    ).toBe(true);
  });

  it("sums multiple allocation lines against the same invoice into one dependency", () => {
    const dependencies = resolvePaymentInvoiceDependencies(
      [
        payment({
          invoiceAllocations: [
            { externalInvoiceId: "qb-invoice-1", amountCents: 10_000 },
            { externalInvoiceId: "qb-invoice-1", amountCents: 5_000 },
          ],
        }),
      ],
      [invoice()],
    );

    expect(dependencies).toHaveLength(1);
    expect(dependencies[0]?.amountCents).toBe(15_000);
  });

  it("resolves multiple installment payments against the same invoice", () => {
    const dependencies = resolvePaymentInvoiceDependencies(
      [
        payment({
          id: "payment-1",
          amountCents: 40_000,
          invoiceAllocations: [
            { externalInvoiceId: "qb-invoice-1", amountCents: 40_000 },
          ],
        }),
        payment({
          id: "payment-2",
          amountCents: 60_000,
          invoiceAllocations: [
            { externalInvoiceId: "qb-invoice-1", amountCents: 60_000 },
          ],
        }),
      ],
      [invoice()],
    );

    expect(dependencies).toHaveLength(2);
    expect(
      dependencies.every((dependency) => dependency.to.id === "invoice-1"),
    ).toBe(true);
  });
});

describe("findDependenciesForInvoice", () => {
  it("filters to dependencies pointing at the given invoice", () => {
    const dependencies = resolvePaymentInvoiceDependencies(
      [payment()],
      [invoice()],
    );

    expect(findDependenciesForInvoice(dependencies, "invoice-1")).toHaveLength(
      1,
    );
    expect(
      findDependenciesForInvoice(dependencies, "invoice-does-not-exist"),
    ).toEqual([]);
  });
});
