import type { Lead } from "@signaldesk/domain";
import { describe, expect, it } from "vitest";

import { integrationHealthIntelligence } from "./integration-health";

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
};

describe("integrationHealthIntelligence", () => {
  it("reports an unconnected foundation-preview connector honestly, with unknown freshness", async () => {
    const findings = await integrationHealthIntelligence.evaluate({
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

    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe("integration.unconnected");
    expect(findings[0]?.freshness).toEqual({ asOf: NOW, status: "unknown" });
    expect(findings[0]?.evidence).toEqual([]);
  });

  it("skips a foundation-preview connector once it's actually connected", async () => {
    const findings = await integrationHealthIntelligence.evaluate({
      leads: [lead],
      now: NOW,
      overdueInvoices: [],
      connectedIntegrationSlugs: ["slack"],
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
    expect(findings[0]?.entity).toEqual({ kind: "connector", id: "hubspot" });
  });

  it("reports nothing once every foundation-preview connector is connected", async () => {
    const findings = await integrationHealthIntelligence.evaluate({
      leads: [lead],
      now: NOW,
      overdueInvoices: [],
      connectedIntegrationSlugs: [
        "slack",
        "hubspot",
        "stripe",
        "quickbooks",
        "gmail",
        "google-calendar",
        "microsoft-outlook",
        "microsoft-calendar",
        "asana",
        "linear",
        "salesforce",
        "xero",
        "jira",
        "zendesk",
      ],
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

    expect(findings).toEqual([]);
  });
});
