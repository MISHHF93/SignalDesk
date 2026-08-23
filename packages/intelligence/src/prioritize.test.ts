import { describe, expect, it } from "vitest";

import type { IntelligenceFinding } from "./finding";
import { prioritizeFindings } from "./prioritize";

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

describe("prioritizeFindings", () => {
  it("computes priorityScore from severity weight plus confidence", () => {
    const [result] = prioritizeFindings([
      finding({ severity: "high", confidence: 0.9 }),
    ]);

    // 70 (high) + 0.9 * 10 = 79
    expect(result?.priorityScore).toBe(79);
  });

  it("sorts findings by descending priority score", () => {
    const critical = finding({ id: "a", severity: "critical", confidence: 1 });
    const info = finding({ id: "b", severity: "info", confidence: 0.5 });
    const medium = finding({ id: "c", severity: "medium", confidence: 0.5 });

    const result = prioritizeFindings([info, medium, critical]);

    expect(result.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("includes the trigger and financial context in priorityReason", () => {
    const [result] = prioritizeFindings([
      finding({
        explanation: { trigger: "No contact in 31 hours.", confidence: "high" },
        financialContext: {
          label: "Pipeline value",
          exposureType: "POTENTIAL_EXPOSURE",
          amountCents: 1_800_000,
          currency: "USD",
        },
      }),
    ]);

    expect(result?.priorityReason).toContain("No contact in 31 hours.");
    expect(
      result?.priorityReason.some((reason) => reason.includes("18,000")),
    ).toBe(true);
  });
});
