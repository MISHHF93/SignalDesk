import { describe, expect, it } from "vitest";

import {
  applyAttentionAdmission,
  DEFAULT_MAX_ADMITTED_FINDINGS,
} from "./attention-admission";
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

describe("applyAttentionAdmission", () => {
  it("admits everything and reports zero deferred when under the cap", () => {
    const prioritized = prioritizeFindings([
      finding({ id: "a", severity: "high" }),
      finding({ id: "b", severity: "medium" }),
    ]);

    const result = applyAttentionAdmission(prioritized, 5);

    expect(result.admitted).toHaveLength(2);
    expect(result.deferredCount).toBe(0);
  });

  it("caps admission at the highest-priority findings, deferring the rest without discarding them from priorityScore ordering", () => {
    const prioritized = prioritizeFindings([
      finding({ id: "low-1", severity: "low" }),
      finding({ id: "critical-1", severity: "critical" }),
      finding({ id: "low-2", severity: "low" }),
      finding({ id: "high-1", severity: "high" }),
    ]);

    const result = applyAttentionAdmission(prioritized, 2);

    expect(result.admitted.map((f) => f.id)).toEqual(["critical-1", "high-1"]);
    expect(result.deferredCount).toBe(2);
  });

  it("never reports a negative deferred count when the cap exceeds the real count", () => {
    const prioritized = prioritizeFindings([finding()]);

    const result = applyAttentionAdmission(prioritized, 100);

    expect(result.deferredCount).toBe(0);
  });

  it("uses DEFAULT_MAX_ADMITTED_FINDINGS when no cap is given", () => {
    const many = Array.from(
      { length: DEFAULT_MAX_ADMITTED_FINDINGS + 5 },
      (_, i) => finding({ id: `finding-${i}`, severity: "medium" }),
    );
    const prioritized = prioritizeFindings(many);

    const result = applyAttentionAdmission(prioritized);

    expect(result.admitted).toHaveLength(DEFAULT_MAX_ADMITTED_FINDINGS);
    expect(result.deferredCount).toBe(5);
  });

  it("returns an empty admitted list and zero deferred for no findings", () => {
    const result = applyAttentionAdmission([]);

    expect(result.admitted).toEqual([]);
    expect(result.deferredCount).toBe(0);
  });
});
