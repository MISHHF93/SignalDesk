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
      lead: lead(),
      now: NOW,
      overdueInvoices: [],
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(0);
  });

  it("fires a lead.ownership_gap finding for a lead with no owner", async () => {
    const findings = await ownershipIntelligence.evaluate({
      lead: lead({ owner: null }),
      now: NOW,
      overdueInvoices: [],
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe("lead.ownership_gap");
    expect(findings[0]?.owner).toBeUndefined();
  });

  it("produces no finding for a real organization with no lead yet", async () => {
    const findings = await ownershipIntelligence.evaluate({
      lead: null,
      now: NOW,
      overdueInvoices: [],
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      overdueTasks: [],
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(0);
  });
});
