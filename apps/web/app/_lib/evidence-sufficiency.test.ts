import type { IntelligenceFinding } from "@signaldesk/intelligence";
import { describe, expect, it } from "vitest";

import { classifyEvidenceSufficiency } from "./evidence-sufficiency";

function finding(
  freshnessStatus: "fresh" | "aging" | "stale",
): IntelligenceFinding {
  return {
    id: "finding-1",
    type: "invoice.overdue",
    title: "Test finding",
    summary: "Test summary",
    severity: "high",
    confidence: 0.9,
    evidence: [],
    freshness: { asOf: new Date(), status: freshnessStatus },
    explanation: { trigger: "Test trigger", confidence: "high" },
    detectedAt: new Date(),
  };
}

describe("classifyEvidenceSufficiency", () => {
  it("returns missing for an empty evidence bundle", () => {
    expect(classifyEvidenceSufficiency([])).toBe("missing");
  });

  it("returns sufficient when at least one finding is fresh", () => {
    expect(
      classifyEvidenceSufficiency([finding("stale"), finding("fresh")]),
    ).toBe("sufficient");
  });

  it("returns sufficient when at least one finding is aging (not fully stale)", () => {
    expect(classifyEvidenceSufficiency([finding("aging")])).toBe("sufficient");
  });

  it("returns stale when every finding is stale", () => {
    expect(
      classifyEvidenceSufficiency([finding("stale"), finding("stale")]),
    ).toBe("stale");
  });
});
