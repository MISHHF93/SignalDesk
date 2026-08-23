import type { PrioritizedFinding } from "@signaldesk/intelligence";
import type { IntelligenceCard } from "@signaldesk/schemas";
import { describe, expect, it } from "vitest";

import {
  assembleBusinessSnapshot,
  type AssembleBusinessSnapshotInput,
  type DomainCoverage,
} from "./business-snapshot";

const NOW = new Date("2026-08-19T14:00:00.000Z");

function finding(
  overrides: Partial<PrioritizedFinding> = {},
): PrioritizedFinding {
  return {
    id: "lead-risk:org-1:lead-1",
    type: "lead.follow_up_risk",
    title: "Priya Nair at Acme Robotics",
    summary: "No recorded interaction for 31 hours.",
    severity: "high",
    confidence: 0.9,
    evidence: [],
    freshness: { asOf: NOW, status: "fresh" },
    explanation: {
      trigger: "No interaction within 24 hours.",
      confidence: "high",
    },
    recommendedActionTypes: ["create_internal_task"],
    detectedAt: NOW,
    priorityScore: 79,
    priorityReason: ["No interaction within 24 hours."],
    ...overrides,
  };
}

function card(overrides: Partial<IntelligenceCard> = {}): IntelligenceCard {
  return {
    id: "lead-risk:org-1:lead-1",
    type: "lead_risk",
    title: "Priya Nair at Acme Robotics",
    summary: "No recorded interaction for 31 hours.",
    priority: 79,
    severity: "high",
    explanation: {
      trigger: "No interaction within 24 hours.",
      confidence: "high",
    },
    sources: [],
    recommendedActions: [],
    freshness: { asOf: NOW, status: "fresh" },
    ...overrides,
  };
}

const BUSINESS_CONTEXT = {
  timezone: "America/Toronto",
  defaultExpectedResponseHours: 24,
  highValueThresholdCents: 1_000_000,
  workingDaysBitmask: 0b0111110,
};

function domainCoverage(
  overrides: Partial<DomainCoverage> = {},
): DomainCoverage {
  return {
    capabilityClass: "crm",
    status: "connected",
    connectedConnectorNames: ["HubSpot"],
    totalConnectorNames: ["HubSpot"],
    ...overrides,
  };
}

function input(
  overrides: Partial<AssembleBusinessSnapshotInput> = {},
): AssembleBusinessSnapshotInput {
  return {
    organizationId: "org-1",
    snapshotId: "snapshot-1",
    now: NOW,
    findings: [],
    cards: [],
    businessContext: BUSINESS_CONTEXT,
    recentActions: [],
    domainHealth: [],
    connectorHealth: [],
    ...overrides,
  };
}

describe("assembleBusinessSnapshot", () => {
  it("carries the identity and business-context fields straight through", () => {
    const snapshot = assembleBusinessSnapshot(input());

    expect(snapshot.organizationId).toBe("org-1");
    expect(snapshot.snapshotId).toBe("snapshot-1");
    expect(snapshot.generatedAt).toEqual(NOW);
    expect(snapshot.businessContext).toEqual(BUSINESS_CONTEXT);
  });

  it("reports an honest empty state for services that don't exist yet", () => {
    const snapshot = assembleBusinessSnapshot(input());

    expect(snapshot.waitingOnMe).toEqual([]);
    expect(snapshot.meaningfulChanges).toEqual([]);
    expect(snapshot.approvals).toEqual([]);
  });

  it("defaults dataThroughAt and freshness to now when there are no findings", () => {
    const snapshot = assembleBusinessSnapshot(input({ findings: [] }));

    expect(snapshot.dataThroughAt).toEqual(NOW);
    expect(snapshot.freshness).toEqual({ status: "fresh" });
  });

  it("takes dataThroughAt as the oldest finding's freshness.asOf", () => {
    const older = new Date("2026-08-17T09:00:00.000Z");
    const newer = new Date("2026-08-19T10:00:00.000Z");
    const snapshot = assembleBusinessSnapshot(
      input({
        findings: [
          finding({ id: "a", freshness: { asOf: newer, status: "fresh" } }),
          finding({ id: "b", freshness: { asOf: older, status: "aging" } }),
        ],
      }),
    );

    expect(snapshot.dataThroughAt).toEqual(older);
  });

  it("reports the worst freshness status across all findings", () => {
    const snapshot = assembleBusinessSnapshot(
      input({
        findings: [
          finding({ id: "a", freshness: { asOf: NOW, status: "fresh" } }),
          finding({ id: "b", freshness: { asOf: NOW, status: "stale" } }),
          finding({ id: "c", freshness: { asOf: NOW, status: "aging" } }),
        ],
      }),
    );

    expect(snapshot.freshness).toEqual({ status: "stale" });
  });

  it("passes findings through as attentionItems and computes pulse counts from them", () => {
    const findings = [
      finding({ id: "a", severity: "critical" }),
      finding({ id: "b", severity: "high" }),
      finding({ id: "c", severity: "high" }),
    ];
    const snapshot = assembleBusinessSnapshot(input({ findings }));

    expect(snapshot.attentionItems).toBe(findings);
    expect(snapshot.pulse).toEqual({
      totalCount: 3,
      criticalCount: 1,
      highCount: 2,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
    });
  });

  it("passes cards through unchanged — the same composed cards the initial server render uses", () => {
    const cards = [card({ id: "a" }), card({ id: "b", type: "invoice_risk" })];
    const snapshot = assembleBusinessSnapshot(input({ cards }));

    expect(snapshot.cards).toBe(cards);
  });

  it("summarizes domain coverage from the real per-capability breakdown", () => {
    const snapshot = assembleBusinessSnapshot(
      input({
        domainHealth: [
          domainCoverage({ capabilityClass: "crm", status: "connected" }),
          domainCoverage({ capabilityClass: "accounting", status: "partial" }),
          domainCoverage({ capabilityClass: "calendar", status: "none" }),
        ],
      }),
    );

    expect(snapshot.coverage).toEqual({
      totalDomains: 3,
      connectedDomains: 1,
      partialDomains: 1,
      uncoveredDomains: 1,
    });
    expect(snapshot.domainHealth).toHaveLength(3);
  });

  it("passes connectorHealth and recentActions through unchanged", () => {
    const connectorHealth = [
      {
        slug: "hubspot",
        name: "HubSpot",
        capabilityClass: "crm" as const,
        status: "connected" as const,
        hasRealSync: true,
      },
    ];
    const recentActions = [
      {
        eventType: "integration.connected",
        subjectType: "integration",
        outcome: "succeeded",
        occurredAt: NOW,
      },
    ];

    const snapshot = assembleBusinessSnapshot(
      input({ connectorHealth, recentActions }),
    );

    expect(snapshot.connectorHealth).toBe(connectorHealth);
    expect(snapshot.recentActions).toBe(recentActions);
  });
});
