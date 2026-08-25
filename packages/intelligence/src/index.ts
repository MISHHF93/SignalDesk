export type {
  IntelligenceType,
  IntelligenceFinding,
  PrioritizedFinding,
} from "./finding";
export type { IntelligenceContext, IntelligenceCapability } from "./capability";
export {
  intelligenceCapabilities,
  runIntelligenceCapabilities,
} from "./registry";
export { prioritizeFindings } from "./prioritize";
export {
  correlateFindingsByName,
  type CorrelationGroup,
} from "./finding-correlation";
export {
  applyAttentionAdmission,
  DEFAULT_MAX_ADMITTED_FINDINGS,
  type AttentionAdmissionResult,
} from "./attention-admission";
export {
  combineSpecialistConfidence,
  CONFIDENCE_DETERMINISTIC_RULE,
  CONTRADICTION_CONFIDENCE_PENALTY,
  CONTRADICTION_CONFIDENCE_SPREAD,
  type CombinedConfidence,
  type SpecialistConfidenceInput,
} from "./confidence";
