export type { SemanticConcept } from "./concepts";
export type { MetricTimeGrain, MetricUnit, MetricValueKind } from "./units";
// Re-exported for backward compatibility — the real definition now lives in
// @signaldesk/domain, the one dependency-free package both `semantics` and
// `schemas` sit above (see that file's doc comment for why).
export { EXPOSURE_TYPE_LABEL, type ExposureType } from "@signaldesk/domain";
export type { SemanticEntity, SemanticField } from "./entities";
export { SEMANTIC_ENTITIES } from "./entities";
export type {
  MetricDefinition,
  MetricLineage,
  MetricLineageRecord,
  MetricValue,
} from "./types";
export {
  ACCOUNTS_RECEIVABLE,
  CASH_COLLECTED_RECENT,
  getMetricDefinition,
  getMetricsForConcept,
  METRIC_CATALOG,
  OPEN_TASK_BACKLOG,
  OVERDUE_RECEIVABLE_EXPOSURE,
  PIPELINE_VALUE,
} from "./catalog";
export {
  type ComputeBusinessMetricsInput,
  computeAccountsReceivable,
  computeBusinessMetrics,
  computeCashCollectedRecent,
  computeOpenTaskBacklog,
  computeOverdueReceivableExposure,
  computePipelineValue,
  groupByCurrency,
} from "./compute";
export {
  type ConnectedAuthority,
  detectMetricAuthorityConflicts,
  type MetricAuthorityConflict,
} from "./authority";
