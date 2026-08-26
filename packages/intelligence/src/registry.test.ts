import type { Lead } from "@signaldesk/domain";
import { describe, expect, it, vi } from "vitest";

import type { IntelligenceCapability } from "./capability";
import {
  intelligenceCapabilities,
  runIntelligenceCapabilities,
} from "./registry";

const NOW = new Date("2026-08-18T14:00:00.000Z");

const lead: Lead = {
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
};

describe("intelligenceCapabilities", () => {
  it("registers every real capability", () => {
    expect(intelligenceCapabilities.map((capability) => capability.id)).toEqual(
      [
        "lead-risk",
        "integration-health",
        "ownership",
        "overdue-invoice",
        "overdue-task",
        "payment-received",
        "goal-variance",
        "message-follow-up",
        "ticket-risk",
      ],
    );
  });
});

describe("runIntelligenceCapabilities", () => {
  it("flattens findings from every registered capability", async () => {
    const findings = await runIntelligenceCapabilities({
      leads: [lead],
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
    const types = findings.map((finding) => finding.type);

    expect(types).toContain("lead.follow_up_risk");
    expect(types).toContain("integration.unconnected");
    expect(types).not.toContain("lead.ownership_gap");
  });

  it("still reports connector facts for a real organization with no lead yet", async () => {
    const findings = await runIntelligenceCapabilities({
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
    const types = findings.map((finding) => finding.type);

    // Real bug found by review: integration-health.ts used to report at
    // most one unconnected connector no matter how many actually were —
    // with zero connectors connected, every real foundation-preview
    // connector in the catalog is genuinely unconnected.
    expect(types.length).toBeGreaterThan(1);
    expect(types.every((type) => type === "integration.unconnected")).toBe(
      true,
    );
  });

  it("still returns findings from the other capabilities when one throws", async () => {
    const brokenCapability = intelligenceCapabilities.find(
      (capability) => capability.id === "integration-health",
    ) as IntelligenceCapability;
    const evaluateSpy = vi
      .spyOn(brokenCapability, "evaluate")
      .mockRejectedValueOnce(new Error("boom"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const findings = await runIntelligenceCapabilities({
      leads: [lead],
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
    const types = findings.map((finding) => finding.type);

    expect(types).toContain("lead.follow_up_risk");
    expect(types).not.toContain("integration.unconnected");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    evaluateSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
