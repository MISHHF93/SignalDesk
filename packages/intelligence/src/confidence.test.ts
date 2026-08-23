import { describe, expect, it } from "vitest";

import { combineSpecialistConfidence } from "./confidence";

describe("combineSpecialistConfidence", () => {
  it("throws for an empty result set — callers must filter first", () => {
    expect(() => combineSpecialistConfidence([])).toThrow();
  });

  it("returns the single value, undetected, for one result", () => {
    const result = combineSpecialistConfidence([{ confidence: 0.8 }]);

    expect(result.confidence).toBe(0.8);
    expect(result.contradictionsDetected).toBe(false);
  });

  it("averages agreeing results without penalty", () => {
    const result = combineSpecialistConfidence([
      { confidence: 0.8 },
      { confidence: 0.9 },
    ]);

    expect(result.confidence).toBeCloseTo(0.85, 5);
    expect(result.contradictionsDetected).toBe(false);
  });

  it("flags and penalizes a wide confidence spread", () => {
    const result = combineSpecialistConfidence([
      { confidence: 0.95 },
      { confidence: 0.4 },
    ]);

    // average = 0.675, spread = 0.55 > 0.4 -> penalized by 0.7
    expect(result.contradictionsDetected).toBe(true);
    expect(result.confidence).toBeCloseTo(0.675 * 0.7, 5);
  });

  it("does not flag a spread exactly at the threshold", () => {
    const result = combineSpecialistConfidence([
      { confidence: 0.9 },
      { confidence: 0.5 },
    ]);

    expect(result.contradictionsDetected).toBe(false);
  });
});
