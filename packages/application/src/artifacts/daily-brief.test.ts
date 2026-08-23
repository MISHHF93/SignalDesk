import type { PrioritizedFinding } from "@signaldesk/intelligence";
import { describe, expect, it } from "vitest";

import { generateDailyBrief, generateSinceYouLeftBrief } from "./daily-brief";

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

describe("generateDailyBrief", () => {
  it("titles the brief with the given date", () => {
    const brief = generateDailyBrief([], NOW);

    expect(brief.title).toBe("Daily Brief — Wednesday, August 19, 2026");
  });

  it("reports an honest empty state when nothing needs attention", () => {
    const brief = generateDailyBrief([], NOW);

    expect(brief.content).toBe("Nothing needs attention right now.");
    expect(brief.structuredData).toEqual({
      totalCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
    });
    expect(brief.sourceFindingIds).toEqual([]);
  });

  it("summarizes counts by severity and lists each finding", () => {
    const findings = [
      finding({ id: "a", severity: "critical", title: "Invoice overdue" }),
      finding({ id: "b", severity: "high", title: "Lead untouched" }),
      finding({ id: "c", severity: "high", title: "Task overdue" }),
    ];

    const brief = generateDailyBrief(findings, NOW);

    expect(brief.content).toContain(
      "3 items need attention today: 1 critical, 2 high.",
    );
    expect(brief.content).toContain("[CRITICAL] Invoice overdue");
    expect(brief.content).toContain("[HIGH] Lead untouched");
    expect(brief.content).toContain("[HIGH] Task overdue");
    expect(brief.structuredData).toEqual({
      totalCount: 3,
      criticalCount: 1,
      highCount: 2,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
    });
    expect(brief.sourceFindingIds).toEqual(["a", "b", "c"]);
  });

  it("uses singular phrasing for exactly one finding", () => {
    const brief = generateDailyBrief([finding()], NOW);

    expect(brief.content).toContain("1 item needs attention today");
  });

  it("preserves the caller's finding order (already priority-sorted)", () => {
    const findings = [
      finding({ id: "highest", priorityScore: 90 }),
      finding({ id: "lowest", priorityScore: 10 }),
    ];

    const brief = generateDailyBrief(findings, NOW);

    expect(brief.sourceFindingIds).toEqual(["highest", "lowest"]);
  });
});

describe("generateSinceYouLeftBrief", () => {
  const PREVIOUS_GENERATED_AT = new Date("2026-08-19T09:00:00.000Z");

  it("titles the brief with the given date", () => {
    const brief = generateSinceYouLeftBrief([], null, NOW);

    expect(brief.title).toBe("Since You Left — Wednesday, August 19, 2026");
  });

  it("falls back to showing everything when no prior brief exists", () => {
    const findings = [
      finding({ id: "overdue-invoice:org-1:inv-1", title: "Invoice overdue" }),
    ];

    const brief = generateSinceYouLeftBrief(findings, null, NOW);

    expect(brief.content).toContain(
      "No prior brief exists yet to compare against",
    );
    expect(brief.content).toContain("Invoice overdue");
    expect(brief.structuredData).toEqual({
      mode: "since_you_left",
      newCount: 1,
      resolvedCount: 0,
      comparedToBriefId: null,
      comparedToBriefGeneratedAt: null,
    });
    expect(brief.sourceFindingIds).toEqual(["overdue-invoice:org-1:inv-1"]);
  });

  it("reports an honest empty state when nothing exists and no prior brief exists", () => {
    const brief = generateSinceYouLeftBrief([], null, NOW);

    expect(brief.content).toBe(
      "No prior brief exists yet, and nothing needs attention right now.",
    );
  });

  it("reports no change when the finding-id set is identical to the previous brief", () => {
    const findings = [finding({ id: "stuck:org-1:lead-1" })];
    const previousBrief = {
      id: "brief-1",
      generatedAt: PREVIOUS_GENERATED_AT,
      sourceFindingIds: ["stuck:org-1:lead-1"],
    };

    const brief = generateSinceYouLeftBrief(findings, previousBrief, NOW);

    expect(brief.content).toContain("Nothing changed since your last brief.");
    expect(brief.structuredData.newCount).toBe(0);
    expect(brief.structuredData.resolvedCount).toBe(0);
  });

  it("reports newly surfaced findings not present in the previous brief", () => {
    const findings = [
      finding({
        id: "overdue-invoice:org-1:inv-9",
        title: "New overdue invoice",
        severity: "critical",
      }),
    ];
    const previousBrief = {
      id: "brief-1",
      generatedAt: PREVIOUS_GENERATED_AT,
      sourceFindingIds: [],
    };

    const brief = generateSinceYouLeftBrief(findings, previousBrief, NOW);

    expect(brief.content).toContain("1 new item surfaced:");
    expect(brief.content).toContain("[CRITICAL] New overdue invoice");
    expect(brief.structuredData.newCount).toBe(1);
    expect(brief.structuredData.resolvedCount).toBe(0);
    expect(brief.structuredData.comparedToBriefId).toBe("brief-1");
  });

  it("reports resolved findings grouped by capability, with correct pluralization", () => {
    const previousBrief = {
      id: "brief-1",
      generatedAt: PREVIOUS_GENERATED_AT,
      sourceFindingIds: [
        "overdue-invoice:org-1:inv-1",
        "overdue-invoice:org-1:inv-2",
        "stuck:org-1:lead-1",
      ],
    };

    const brief = generateSinceYouLeftBrief([], previousBrief, NOW);

    expect(brief.content).toContain("3 items resolved:");
    expect(brief.content).toContain("2 overdue invoices");
    expect(brief.content).toContain("1 stuck lead");
    expect(brief.structuredData.resolvedCount).toBe(3);
  });

  it("reports both new and resolved findings in the same brief", () => {
    const findings = [finding({ id: "overdue-task:org-1:task-9" })];
    const previousBrief = {
      id: "brief-1",
      generatedAt: PREVIOUS_GENERATED_AT,
      sourceFindingIds: ["stuck:org-1:lead-1"],
    };

    const brief = generateSinceYouLeftBrief(findings, previousBrief, NOW);

    expect(brief.structuredData.newCount).toBe(1);
    expect(brief.structuredData.resolvedCount).toBe(1);
    expect(brief.content).toContain("1 new item surfaced:");
    expect(brief.content).toContain("1 item resolved:");
    expect(brief.content).toContain("1 stuck lead");
  });

  it("labels goal-variance/message-follow-up/ticket-risk resolved findings, not their raw capability ids", () => {
    const previousBrief = {
      id: "brief-1",
      generatedAt: PREVIOUS_GENERATED_AT,
      sourceFindingIds: [
        "goal-variance:org-1:goal-1",
        "message-follow-up:org-1:msg-1",
        "ticket-risk:org-1:ticket-1",
      ],
    };

    const brief = generateSinceYouLeftBrief([], previousBrief, NOW);

    expect(brief.content).toContain("1 goal at risk");
    expect(brief.content).toContain("1 message awaiting reply");
    expect(brief.content).toContain("1 stuck support ticket");
    expect(brief.content).not.toContain("goal-variance");
    expect(brief.content).not.toContain("message-follow-up");
    expect(brief.content).not.toContain("ticket-risk");
  });

  it("uses unrecognized capability ids verbatim rather than throwing", () => {
    const previousBrief = {
      id: "brief-1",
      generatedAt: PREVIOUS_GENERATED_AT,
      sourceFindingIds: ["future-capability:org-1:thing-1"],
    };

    const brief = generateSinceYouLeftBrief([], previousBrief, NOW);

    expect(brief.content).toContain("1 future-capability");
  });
});
