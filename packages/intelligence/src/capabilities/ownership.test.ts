import type { Lead } from "@signaldesk/domain";
import { describe, expect, it } from "vitest";

import { ownershipIntelligence } from "./ownership";

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
    lastInteractionAt: new Date("2026-08-18T13:00:00.000Z"),
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

describe("ownershipIntelligence", () => {
  it("produces no finding for a lead that has an assigned owner", async () => {
    const findings = await ownershipIntelligence.evaluate({
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

    expect(findings).toHaveLength(0);
  });

  it("fires a lead.ownership_gap finding for a lead with no owner", async () => {
    const findings = await ownershipIntelligence.evaluate({
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

    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe("lead.ownership_gap");
    expect(findings[0]?.owner).toBeUndefined();
    expect(findings[0]?.recommendedActionTypes).toEqual([
      "create_internal_task",
    ]);
    expect(findings[0]?.correlationName).toBe("northstar dental");
    expect(findings[0]?.explanation.observedValue).toBe("No owner assigned.");
  });

  it("produces one finding per ownerless lead, evaluating the full candidate set — not just the first", async () => {
    const findings = await ownershipIntelligence.evaluate({
      leads: [
        lead({ id: "lead_001", companyName: "Northstar Dental", owner: null }),
        lead({ id: "lead_002", companyName: "Acme Robotics", owner: null }),
      ],
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

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.entity)).toEqual([
      { kind: "lead", id: "lead_001" },
      { kind: "lead", id: "lead_002" },
    ]);
  });

  it("skips an owned lead but still flags an ownerless one in the same candidate set", async () => {
    const findings = await ownershipIntelligence.evaluate({
      leads: [
        lead({ id: "lead_001" }), // has an owner, per the default fixture
        lead({ id: "lead_002", owner: null }),
      ],
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

    expect(findings).toHaveLength(1);
    expect(findings[0]?.entity).toEqual({ kind: "lead", id: "lead_002" });
  });

  it("produces no finding for a real organization with no lead yet", async () => {
    const findings = await ownershipIntelligence.evaluate({
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

    expect(findings).toHaveLength(0);
  });
});
