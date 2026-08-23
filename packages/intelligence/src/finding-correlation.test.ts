import { describe, expect, it } from "vitest";

import { correlateFindingsByName } from "./finding-correlation";
import { prioritizeFindings } from "./prioritize";
import type { IntelligenceFinding } from "./finding";

function finding(
  overrides: Partial<IntelligenceFinding> = {},
): IntelligenceFinding {
  return {
    id: "finding-1",
    type: "lead.follow_up_risk",
    title: "Test finding",
    summary: "Test summary",
    severity: "medium",
    confidence: 0.5,
    evidence: [],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "Test trigger", confidence: "high" },
    detectedAt: new Date(),
    ...overrides,
  };
}

describe("correlateFindingsByName", () => {
  it("groups two findings that share the same real correlationName", () => {
    const prioritized = prioritizeFindings([
      finding({
        id: "invoice-1",
        type: "invoice.overdue",
        correlationName: "acme robotics",
      }),
      finding({
        id: "lead-1",
        type: "lead.follow_up_risk",
        correlationName: "acme robotics",
      }),
    ]);

    const groups = correlateFindingsByName(prioritized);

    expect(groups.get("invoice-1")?.findingIds).toEqual(
      expect.arrayContaining(["invoice-1", "lead-1"]),
    );
    expect(groups.get("lead-1")).toBe(groups.get("invoice-1"));
  });

  it("does not group a finding with no correlationName", () => {
    const prioritized = prioritizeFindings([
      finding({ id: "a" }),
      finding({ id: "b" }),
    ]);

    const groups = correlateFindingsByName(prioritized);

    expect(groups.size).toBe(0);
  });

  it("does not group a finding whose correlationName matches nothing else", () => {
    const prioritized = prioritizeFindings([
      finding({ id: "a", correlationName: "acme robotics" }),
      finding({ id: "b", correlationName: "northstar dental" }),
    ]);

    const groups = correlateFindingsByName(prioritized);

    expect(groups.size).toBe(0);
  });

  it("does not group a lone finding with itself", () => {
    const prioritized = prioritizeFindings([
      finding({ id: "a", correlationName: "acme robotics" }),
    ]);

    const groups = correlateFindingsByName(prioritized);

    expect(groups.size).toBe(0);
  });

  it("groups three or more findings sharing the same name into one group", () => {
    const prioritized = prioritizeFindings([
      finding({ id: "a", correlationName: "acme robotics" }),
      finding({ id: "b", correlationName: "acme robotics" }),
      finding({ id: "c", correlationName: "acme robotics" }),
    ]);

    const groups = correlateFindingsByName(prioritized);

    expect(groups.get("a")?.findingIds).toHaveLength(3);
    expect(groups.get("b")).toBe(groups.get("a"));
    expect(groups.get("c")).toBe(groups.get("a"));
  });

  it("keeps separate customers in separate groups", () => {
    const prioritized = prioritizeFindings([
      finding({ id: "a1", correlationName: "acme robotics" }),
      finding({ id: "a2", correlationName: "acme robotics" }),
      finding({ id: "n1", correlationName: "northstar dental" }),
      finding({ id: "n2", correlationName: "northstar dental" }),
    ]);

    const groups = correlateFindingsByName(prioritized);

    expect(groups.get("a1")?.correlationName).toBe("acme robotics");
    expect(groups.get("n1")?.correlationName).toBe("northstar dental");
    expect(groups.get("a1")?.findingIds).not.toContain("n1");
  });
});
