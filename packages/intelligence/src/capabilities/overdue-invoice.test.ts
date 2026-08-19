import type { Invoice } from "@business-dashboard/domain";
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

describe("overdueInvoiceIntelligence", () => {
  it("fires an invoice.overdue finding carrying the real receivable amount", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      lead: null,
      overdueInvoices: [invoice()],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe("invoice.overdue");
    expect(findings[0]?.entity).toEqual({ kind: "invoice", id: "invoice_001" });
    expect(findings[0]?.financialContext).toEqual({
      label: "Overdue receivable",
      amountCents: 250_000,
      currency: "USD",
    });
  });

  it("produces one finding per overdue invoice", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      lead: null,
      overdueInvoices: [
        invoice({ id: "invoice_001" }),
        invoice({ id: "invoice_002", customerName: "Acme Robotics" }),
      ],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.entity?.id)).toEqual([
      "invoice_001",
      "invoice_002",
    ]);
  });

  it("classifies severity as critical at or above the organization's threshold", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      lead: null,
      overdueInvoices: [invoice({ amountCents: 2_000_000 })],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings[0]?.severity).toBe("critical");
  });

  it("produces no finding when there are no overdue invoices", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      lead: null,
      overdueInvoices: [],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(0);
  });

  it("produces no finding for an invoice not yet past its due date", async () => {
    const findings = await overdueInvoiceIntelligence.evaluate({
      lead: null,
      overdueInvoices: [
        invoice({ dueAt: new Date("2026-09-01T00:00:00.000Z") }),
      ],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(0);
  });
});
