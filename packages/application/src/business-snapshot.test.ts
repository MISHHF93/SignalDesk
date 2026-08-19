import type { PrioritizedFinding } from "@signaldesk/intelligence";
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
    id: "stuck:org-1:lead-1",
    type: "lead.untouched",
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
    purpose: "pipeline",
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

  it("summarizes domain coverage from the real per-purpose breakdown", () => {
    const snapshot = assembleBusinessSnapshot(
      input({
        domainHealth: [
          domainCoverage({ purpose: "pipeline", status: "connected" }),
          domainCoverage({ purpose: "finance", status: "partial" }),
          domainCoverage({ purpose: "calendar", status: "none" }),
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
        purpose: "pipeline" as const,
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
