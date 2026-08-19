import type { Lead } from "@signaldesk/domain";
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

describe("createBusinessAIOrchestrator", () => {
  it("runs the Intelligence Core and composes prioritized findings into cards", async () => {
    const orchestrator = createBusinessAIOrchestrator({
      provider: createDeterministicProvider(),
    });

    const attention = await orchestrator.getAttention({
      lead: lead(),
      now: NOW,
      overdueInvoices: [],
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(attention.findings.length).toBeGreaterThanOrEqual(3);
    expect(attention.cards.map((card) => card.type)).toEqual(
      expect.arrayContaining(["stuck", "lead_risk", "integration_health"]),
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
      lead: lead(),
      now: NOW,
      overdueInvoices: [],
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
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
      lead: lead({ owner: null }),
      now: NOW,
      overdueInvoices: [],
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
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
      lead: null,
      now: NOW,
      overdueInvoices: [],
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(attention.findings.map((finding) => finding.type)).toEqual([
      "integration.unconnected",
    ]);
    expect(attention.cards.map((card) => card.type)).toEqual([
      "integration_health",
    ]);
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
