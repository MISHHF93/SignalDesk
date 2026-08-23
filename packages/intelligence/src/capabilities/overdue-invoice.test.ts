import type { Invoice, Payment } from "@signaldesk/domain";
import { describe, expect, it } from "vitest";

import { overdueInvoiceIntelligence } from "./overdue-invoice";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice_001",
    organizationId: "org_001",
    customerName: "Northstar Dental",
    amountCents: 250_000,
    currency: "USD",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
    status: "open",
    source: {
      integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
      system: "quickbooks",
      externalRecordId: "qb_90210",
      sourceVersion: "3",
      recordDigestSha256: "b".repeat(64),
      lastSyncedAt: new Date("2026-08-18T13:56:00.000Z"),
    },
    ...overrides,
  };
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment_001",
    organizationId: "org_001",
    customerName: "Northstar Dental",
    amountCents: 100_000,
    currency: "USD",
    receivedAt: new Date("2026-08-10T00:00:00.000Z"),
    invoiceAllocations: [
      { externalInvoiceId: "qb_90210", amountCents: 100_000 },
    ],
    source: {
      integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
      system: "quickbooks",
      externalRecordId: "qb_payment_1",
      sourceVersion: "1",
      recordDigestSha256: "c".repeat(64),
      lastSyncedAt: new Date("2026-08-18T13:56:00.000Z"),
    },
    ...overrides,
  };
}

describe("overdueInvoiceIntelligence", () => {
  it("fires an invoice.overdue finding carrying the real receivable amount", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      leads: [],
      overdueInvoices: [invoice()],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      recentPayments: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe("invoice.overdue");
    expect(findings[0]?.entity).toEqual({ kind: "invoice", id: "invoice_001" });
    expect(findings[0]?.financialContext).toEqual({
      label: "Overdue receivable",
      exposureType: "OUTSTANDING_AMOUNT",
      amountCents: 250_000,
      currency: "USD",
    });
    // Normalized (trim + lowercase), matching `normalizeEntityName`
    // (@signaldesk/domain) — the same key `correlateFindingsByName`
    // (@signaldesk/intelligence) groups findings on.
    expect(findings[0]?.correlationName).toBe("northstar dental");
  });

  it("produces one finding per overdue invoice", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      leads: [],
      overdueInvoices: [
        invoice({ id: "invoice_001" }),
        invoice({ id: "invoice_002", customerName: "Acme Robotics" }),
      ],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      recentPayments: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.entity?.id)).toEqual([
      "invoice_001",
      "invoice_002",
    ]);
  });

  it("classifies severity as critical at or above the organization's threshold", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      leads: [],
      overdueInvoices: [invoice({ amountCents: 2_000_000 })],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      recentPayments: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    expect(findings[0]?.severity).toBe("critical");
  });

  it("produces no finding when there are no overdue invoices", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      leads: [],
      overdueInvoices: [],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      recentPayments: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    expect(findings).toHaveLength(0);
  });

  it("produces no finding for an invoice not yet past its due date", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      leads: [],
      overdueInvoices: [
        invoice({ dueAt: new Date("2026-09-01T00:00:00.000Z") }),
      ],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      recentPayments: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    expect(findings).toHaveLength(0);
  });

  it("enriches the finding when a real payment is linked to the still-overdue invoice", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      leads: [],
      overdueInvoices: [invoice()],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      recentPayments: [payment()],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    expect(findings[0]?.summary).toContain("1000.00 USD");
    expect(findings[0]?.summary).toContain("already been received");
    expect(findings[0]?.explanation.observedValue).toContain(
      "1000.00 USD received but unresolved",
    );
    expect(findings[0]?.evidence).toHaveLength(2);
    expect(
      findings[0]?.evidence.some(
        (reference) => reference.externalRecordId === "qb_payment_1",
      ),
    ).toBe(true);
  });

  it("never blends a linked payment's amount into the total when its currency differs from the invoice's own — even though this can't happen with today's single-connector data, the guard must hold", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      leads: [],
      overdueInvoices: [invoice({ currency: "USD" })],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      recentPayments: [payment({ currency: "EUR" })],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    // A different-currency linked payment must never be folded into the
    // "already received" narrative or its evidence — the real bug this
    // guards against would otherwise sum a EUR amount into a figure
    // labeled USD.
    expect(findings[0]?.summary).not.toContain("already been received");
    expect(findings[0]?.explanation.observedValue).not.toContain(
      "received but unresolved",
    );
    expect(findings[0]?.evidence).toHaveLength(1);
  });

  it("attributes only its own allocated share of a bulk payment, not the payment's full amount", async () => {
    const otherInvoice = invoice({
      id: "invoice_002",
      customerName: "Other Customer",
      source: {
        integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
        system: "quickbooks",
        externalRecordId: "qb_other_invoice",
        sourceVersion: "1",
        recordDigestSha256: "d".repeat(64),
        lastSyncedAt: new Date("2026-08-18T13:56:00.000Z"),
      },
    });
    const bulkPayment = payment({
      amountCents: 250_000,
      invoiceAllocations: [
        { externalInvoiceId: "qb_90210", amountCents: 100_000 },
        { externalInvoiceId: "qb_other_invoice", amountCents: 150_000 },
      ],
    });

    const findings = await overdueInvoiceIntelligence.evaluate({
      leads: [],
      overdueInvoices: [invoice(), otherInvoice],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      recentPayments: [bulkPayment],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    const original = findings.find(
      (finding) => finding.entity?.id === "invoice_001",
    );
    const other = findings.find(
      (finding) => finding.entity?.id === "invoice_002",
    );

    // Each invoice sees only its own allocated $1,000/$1,500 — never the
    // bulk payment's full $2,500 total on both.
    expect(original?.summary).toContain("1000.00 USD");
    expect(original?.summary).not.toContain("2500.00 USD");
    expect(other?.summary).toContain("1500.00 USD");
    expect(other?.summary).not.toContain("2500.00 USD");
  });

  it("does not enrich the finding when the linked payment is for a different invoice", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      leads: [],
      overdueInvoices: [invoice()],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      recentPayments: [
        payment({
          invoiceAllocations: [
            {
              externalInvoiceId: "qb_some_other_invoice",
              amountCents: 100_000,
            },
          ],
        }),
      ],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    expect(findings[0]?.summary).not.toContain("already been received");
    expect(findings[0]?.evidence).toHaveLength(1);
  });

  it("leaves the finding unchanged when there are no recent payments at all", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      leads: [],
      overdueInvoices: [invoice()],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      recentPayments: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    expect(findings[0]?.summary).toBe(
      "Invoice for Northstar Dental is 17 days past its due date and still unpaid.",
    );
    expect(findings[0]?.evidence).toHaveLength(1);
  });
});
