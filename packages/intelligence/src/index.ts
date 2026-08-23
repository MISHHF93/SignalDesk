export { getLeadAttention, type LeadAttentionResult } from "./leadAttention";
export type {
  IntelligenceType,
  IntelligenceFinding,
  PrioritizedFinding,
} from "./finding";
export type { IntelligenceContext, IntelligenceCapability } from "./capability";
export { leadRiskIntelligence } from "./capabilities/lead-risk";
export { integrationHealthIntelligence } from "./capabilities/integration-health";
export { ownershipIntelligence } from "./capabilities/ownership";
export { overdueInvoiceIntelligence } from "./capabilities/overdue-invoice";
export { overdueTaskIntelligence } from "./capabilities/overdue-task";
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
