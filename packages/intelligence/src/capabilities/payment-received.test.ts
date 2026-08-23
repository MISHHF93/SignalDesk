import type { Payment } from "@signaldesk/domain";
import { describe, expect, it } from "vitest";

import { paymentReceivedIntelligence } from "./payment-received";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment_001",
    organizationId: "org_001",
    customerName: "Northstar Dental",
    amountCents: 150_000,
    currency: "USD",
    receivedAt: new Date("2026-08-18T00:00:00.000Z"),
    invoiceAllocations: [
      { externalInvoiceId: "qb_90210", amountCents: 150_000 },
    ],
    source: {
      integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
      system: "quickbooks",
      externalRecordId: "qb_pmt_1",
      sourceVersion: "0",
      recordDigestSha256: "b".repeat(64),
      lastSyncedAt: new Date("2026-08-18T13:56:00.000Z"),
    },
    ...overrides,
  };
}

describe("paymentReceivedIntelligence", () => {
  it("fires a payment.received finding carrying the real amount, at info severity", async () => {
    const findings = await paymentReceivedIntelligence.evaluate({
      leads: [],
      overdueInvoices: [],
      overdueTasks: [],
      recentPayments: [payment()],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe("payment.received");
    expect(findings[0]?.severity).toBe("info");
    expect(findings[0]?.entity).toEqual({ kind: "payment", id: "payment_001" });
    expect(findings[0]?.financialContext).toEqual({
      label: "Confirmed revenue",
      exposureType: "CONFIRMED_AMOUNT",
      amountCents: 150_000,
      currency: "USD",
    });
  });

  it("produces one finding per recent payment", async () => {
    const findings = await paymentReceivedIntelligence.evaluate({
      leads: [],
      overdueInvoices: [],
      overdueTasks: [],
      recentPayments: [
        payment({ id: "payment_001" }),
        payment({ id: "payment_002", customerName: "Acme Robotics" }),
      ],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
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
      "payment_001",
      "payment_002",
    ]);
  });

  it("produces no finding when there are no recent payments", async () => {
    const findings = await paymentReceivedIntelligence.evaluate({
      leads: [],
      overdueInvoices: [],
      overdueTasks: [],
      recentPayments: [],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
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

  it("recommends no actions — a payment is a confirmation, not a task to assign", async () => {
    const findings = await paymentReceivedIntelligence.evaluate({
      leads: [],
      overdueInvoices: [],
      overdueTasks: [],
      recentPayments: [payment()],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
      goals: [],
      businessMetrics: [],
      recentUnansweredMessages: [],
      stuckSupportTickets: [],
      defaultExpectedResponseHours: 24,
    });

    expect(findings[0]?.recommendedActionTypes).toEqual([]);
  });
});
