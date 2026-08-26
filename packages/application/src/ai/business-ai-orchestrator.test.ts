import type { Invoice, Lead } from "@signaldesk/domain";
import { DEFAULT_MAX_ADMITTED_FINDINGS } from "@signaldesk/intelligence";
import { describe, expect, it } from "vitest";

import { createBusinessAIOrchestrator } from "./business-ai-orchestrator";
import { createDeterministicProvider } from "./deterministic-provider";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead_001",
    organizationId: "org_001",
    contactName: "Alex Rivera",
    companyName: "Northstar Dental",
    valueCents: 1_800_000,
    currency: "USD",
    owner: { id: "user_001", name: "Sarah Chen" },
    stage: "Qualified",
    createdAt: new Date("2026-08-17T17:00:00.000Z"),
    lastInteractionAt: null,
    expectedResponseHours: 4,
    source: {
      integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
      system: "hubspot",
      externalRecordId: "hs_90210",
      sourceVersion: "v1",
      recordDigestSha256: "a".repeat(64),
      lastSyncedAt: new Date("2026-08-18T13:56:00.000Z"),
    },
    ...overrides,
  };
}

function overdueInvoice(id: string): Invoice {
  return {
    id,
    organizationId: "org_001",
    customerName: `Customer ${id}`,
    amountCents: 250_000,
    currency: "USD",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
    status: "open",
    source: {
      integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
      system: "quickbooks",
      externalRecordId: `invoice-${id}`,
      sourceVersion: "1",
      recordDigestSha256: "a".repeat(64),
      lastSyncedAt: new Date("2026-08-18T13:56:00.000Z"),
    },
  };
}

describe("createBusinessAIOrchestrator", () => {
  it("runs the Intelligence Core and composes prioritized findings into cards", async () => {
    const orchestrator = createBusinessAIOrchestrator({
      provider: createDeterministicProvider(),
    });

    const attention = await orchestrator.getAttention({
      leads: [lead()],
      now: NOW,
      overdueInvoices: [],
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

    expect(attention.findings.length).toBeGreaterThanOrEqual(2);
    expect(attention.cards.map((card) => card.type)).toEqual(
      expect.arrayContaining(["lead_risk", "integration_health"]),
    );
    // Findings and cards are both already in priority order (highest first).
    const scores = attention.findings.map((finding) => finding.priorityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("produces no ownership-gap finding for a lead that has an owner", async () => {
    const orchestrator = createBusinessAIOrchestrator({
      provider: createDeterministicProvider(),
    });

    const attention = await orchestrator.getAttention({
      leads: [lead()],
      now: NOW,
      overdueInvoices: [],
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

    expect(
      attention.findings.some(
        (finding) => finding.type === "lead.ownership_gap",
      ),
    ).toBe(false);
  });

  it("produces an ownership-gap finding for a lead with no owner", async () => {
    const orchestrator = createBusinessAIOrchestrator({
      provider: createDeterministicProvider(),
    });

    const attention = await orchestrator.getAttention({
      leads: [lead({ owner: null })],
      now: NOW,
      overdueInvoices: [],
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

    expect(
      attention.findings.some(
        (finding) => finding.type === "lead.ownership_gap",
      ),
    ).toBe(true);
  });

  it("still reports connector facts for a real organization with no lead yet", async () => {
    const orchestrator = createBusinessAIOrchestrator({
      provider: createDeterministicProvider(),
    });

    const attention = await orchestrator.getAttention({
      leads: [],
      now: NOW,
      overdueInvoices: [],
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

    // Real bug found by review: integration-health.ts used to report at
    // most one unconnected connector no matter how many actually were —
    // with zero connectors connected, every real foundation-preview
    // connector in the catalog is genuinely unconnected, so more than one
    // finding/card is the correct behavior here now.
    expect(attention.findings.length).toBeGreaterThan(1);
    expect(
      attention.findings.every(
        (finding) => finding.type === "integration.unconnected",
      ),
    ).toBe(true);
    expect(attention.cards.length).toBeGreaterThan(1);
    expect(
      attention.cards.every((card) => card.type === "integration_health"),
    ).toBe(true);
  });

  it("caps admitted cards below the total finding count and reports the honest deferred count", async () => {
    const orchestrator = createBusinessAIOrchestrator({
      provider: createDeterministicProvider(),
    });
    const manyOverdueInvoices = Array.from(
      { length: DEFAULT_MAX_ADMITTED_FINDINGS + 8 },
      (_, i) => overdueInvoice(`inv-${i}`),
    );

    const attention = await orchestrator.getAttention({
      leads: [],
      now: NOW,
      overdueInvoices: manyOverdueInvoices,
      connectedIntegrationSlugs: ["quickbooks"],
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

    // The real, complete picture is still on `findings` — admission never
    // discards evidence, only bounds what's presented as cards. (Other
    // capabilities, e.g. integration-health, may contribute a finding or
    // two of their own alongside the overdue-invoice ones, so this checks
    // "at least the real invoices," not an exact total.)
    expect(attention.findings.length).toBeGreaterThanOrEqual(
      manyOverdueInvoices.length,
    );
    expect(attention.cards.length).toBe(DEFAULT_MAX_ADMITTED_FINDINGS);
    expect(attention.deferredCount).toBe(
      attention.findings.length - DEFAULT_MAX_ADMITTED_FINDINGS,
    );
  });

  it("routes the Command Bar through interpretCommand", async () => {
    const orchestrator = createBusinessAIOrchestrator({
      provider: createDeterministicProvider(),
    });

    const result = await orchestrator.interpretCommand(
      "show only high items",
      [],
    );

    expect(result).toEqual({
      recognized: true,
      intent: {
        type: "filter",
        filters: [{ field: "severity", operator: "eq", value: "high" }],
      },
    });
  });
});
