import type { PrioritizedFinding } from "@signaldesk/intelligence";
import { describe, expect, it } from "vitest";

import { generateDailyBrief } from "./daily-brief";

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
