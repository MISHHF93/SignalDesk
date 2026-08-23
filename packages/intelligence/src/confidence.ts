/**
 * Shared confidence constants for deterministic (non-model) capabilities.
 * Not a fixed platform policy in the configuration-taxonomy sense — just a
 * single source of truth so identical values aren't hand-copied across
 * capability files and drift independently.
 */
export const CONFIDENCE_DETERMINISTIC_RULE = 0.9;

/**
 * How far apart two specialists' confidence can be before this is treated
 * as real disagreement rather than ordinary variance. Deliberately coarse —
 * a narrow, explainable proxy for "these specialists don't agree," not full
 * natural-language contradiction detection (see
 * agent-result-reconciler.ts, @signaldesk/application, for where actual
 * evidence-level contradiction would need to be built if ever justified).
 */
export const CONTRADICTION_CONFIDENCE_SPREAD = 0.4;

/**
 * Applied to the averaged confidence when CONTRADICTION_CONFIDENCE_SPREAD
 * is exceeded — the reconciler still produces one recommendation, but never
 * at the same confidence it would have reported had every specialist agreed.
 */
export const CONTRADICTION_CONFIDENCE_PENALTY = 0.7;

export interface SpecialistConfidenceInput {
  readonly confidence: number;
}

export interface CombinedConfidence {
  readonly confidence: number;
  readonly contradictionsDetected: boolean;
}

/**
 * Combines two or more specialists' independently-reported confidence into
 * one value a reconciled recommendation can carry. Deliberately simple and
 * documented rather than an opaque score (mission: "no coefficient may be
 * presented as scientifically meaningful without a documented rationale") —
 * average confidence across every input, penalized when the spread between
 * the highest and lowest exceeds CONTRADICTION_CONFIDENCE_SPREAD, since a
 * wide spread means the specialists don't actually agree even though both
 * produced a result.
 *
 * Throws on an empty input — there is no meaningful "combined confidence"
 * for zero results; callers (agent-result-reconciler.ts) must filter to
 * completed results before calling this, and an empty result set is
 * honest abstention (return `null`), never a fabricated confidence.
 */
export function combineSpecialistConfidence(
  results: readonly SpecialistConfidenceInput[],
): CombinedConfidence {
  if (results.length === 0) {
    throw new Error("combineSpecialistConfidence requires at least one result");
  }

  const confidences = results.map((result) => result.confidence);
  const average =
    confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  const spread = Math.max(...confidences) - Math.min(...confidences);
  const contradictionsDetected = spread > CONTRADICTION_CONFIDENCE_SPREAD;

  return {
    confidence: contradictionsDetected
      ? average * CONTRADICTION_CONFIDENCE_PENALTY
      : average,
    contradictionsDetected,
  };
}
