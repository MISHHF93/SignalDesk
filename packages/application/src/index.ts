export { composeCards } from "./cards/dashboard-composition";
export {
  assembleBusinessSnapshot,
  type AssembleBusinessSnapshotInput,
  type BusinessContextProfile,
  type BusinessCoverageSummary,
  type BusinessDomainPurpose,
  type BusinessSnapshot,
  type BusinessSnapshotPulse,
  type ConnectorHealthSummary,
  type DomainCoverage,
  type DomainCoverageStatus,
  type MeaningfulChange,
  type PendingApproval,
  type RecentActionSummary,
  type SnapshotFreshness,
  type SnapshotFreshnessStatus,
} from "./business-snapshot";
export {
  countFindingsBySeverity,
  type SeverityCounts,
} from "./severity-counts";
export {
  generateDailyBrief,
  type DailyBriefContent,
} from "./artifacts/daily-brief";
export type {
  AIProvider,
  DashboardCommandContext,
  GenerateStructuredInput,
  StructuredGenerationTask,
} from "./ai/ai-provider";
export { createDeterministicProvider } from "./ai/deterministic-provider";
export { parseCommand, type ParseCommandResult } from "./ai/parse-command";
export {
  createBusinessAIOrchestrator,
  type BusinessAIOrchestrator,
  type BusinessAIOrchestratorDependencies,
  type BusinessAttention,
} from "./ai/business-ai-orchestrator";
export type {
  IntelligenceContext,
  IntelligenceFinding,
  PrioritizedFinding,
} from "@business-dashboard/intelligence";
export {
  getLeadAttention,
  type LeadAttentionResult,
} from "@business-dashboard/intelligence";
