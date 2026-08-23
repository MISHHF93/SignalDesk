import type { SemanticConcept } from "./concepts";
import type { MetricDefinition } from "./types";

/**
 * The five metrics genuinely computable from data this app already syncs
 * (`getTodaysAttention`'s existing reads, `apps/web`), each declared as its
 * own typed constant rather than assembled through a lookup — every real
 * caller in `compute.ts` references one of these directly, so there is no
 * "unknown metric id" case for that code to defensively handle (see
 * `getMetricDefinition` below for the one real lookup use: resolving an
 * id the UI received back from a `MetricValue`).
 *
 * Deliberately does not yet cover every `SemanticConcept` — `Revenue`,
 * `WorkInProgress`, `Capacity`, `Utilization`, `Margin`, `CustomerValue`,
 * `OpportunityValue`, `Commitment`, `Deadline`, `Risk`, `ResponseTime`,
 * `SLA`, and `Ownership` have no real formula yet because no connector this
 * app has synced carries the underlying data (cost rates, SLA policies,
 * contract terms, ...). Widen this catalog when a real data source for one
 * of those exists, not speculatively.
 */
export const ACCOUNTS_RECEIVABLE: MetricDefinition = {
  id: "accounts_receivable",
  concept: "AccountsReceivable",
  name: "Accounts receivable",
  description:
    "Total amount owed to the business across every open (unpaid) invoice, regardless of due date.",
  unit: "currency",
  timeGrain: "as_of_now",
  valueKind: "DERIVED_VALUE",
  formulaId: "sum_open_invoice_amount",
  formulaVersion: "v1",
  formulaDescription:
    "Sum of amountCents across every invoice with status = open.",
  authorityCapabilityClass: "accounting",
  dependsOnMetricIds: [],
  // Real, owed, not yet in jeopardy — the direct analog of Prompt 26's
  // own OUTSTANDING_AMOUNT.
  exposureType: "OUTSTANDING_AMOUNT",
};

export const OVERDUE_RECEIVABLE_EXPOSURE: MetricDefinition = {
  id: "overdue_receivable_exposure",
  concept: "Exposure",
  name: "Overdue receivable exposure",
  description:
    "The subset of accounts receivable that is past its due date — the real dollar exposure behind every overdue-invoice finding.",
  unit: "currency",
  timeGrain: "as_of_now",
  valueKind: "DERIVED_VALUE",
  formulaId: "sum_overdue_invoice_amount",
  formulaVersion: "v1",
  formulaDescription:
    "Sum of amountCents across every invoice with status = open and dueAt in the past.",
  authorityCapabilityClass: "accounting",
  dependsOnMetricIds: [],
  // Past due — genuinely in jeopardy of non-payment, not just outstanding.
  exposureType: "AT_RISK_AMOUNT",
};

export const PIPELINE_VALUE: MetricDefinition = {
  id: "pipeline_value",
  concept: "Pipeline",
  name: "Pipeline value",
  description:
    "Total recorded value across every synced opportunity. Does not exclude closed-won or closed-lost deals — pipeline stage is tenant-configurable free text from the source CRM, not a canonical closed/open classification this app can rely on yet, so this honestly counts every synced lead.",
  unit: "currency",
  timeGrain: "as_of_now",
  valueKind: "DERIVED_VALUE",
  formulaId: "sum_lead_value",
  formulaVersion: "v1",
  formulaDescription: "Sum of valueCents across every synced lead.",
  authorityCapabilityClass: "crm",
  dependsOnMetricIds: [],
  // Not yet earned or contracted — real upside/downside exposure, per
  // Prompt 26's own example list ("pipeline exposure").
  exposureType: "POTENTIAL_EXPOSURE",
};

export const CASH_COLLECTED_RECENT: MetricDefinition = {
  id: "cash_collected_recent",
  concept: "Cash",
  name: "Cash collected (recent)",
  description:
    "Total payments received in the window the connected accounting/payments system reports as recent.",
  unit: "currency",
  timeGrain: "as_of_now",
  valueKind: "DERIVED_VALUE",
  formulaId: "sum_recent_payment_amount",
  formulaVersion: "v1",
  formulaDescription:
    "Sum of amountCents across every recently observed payment.",
  authorityCapabilityClass: "payments",
  dependsOnMetricIds: [],
  // Already received — real, booked money, not exposure at all.
  exposureType: "CONFIRMED_AMOUNT",
};

export const OPEN_TASK_BACKLOG: MetricDefinition = {
  id: "open_task_backlog",
  concept: "Backlog",
  name: "Open task backlog",
  description: "Count of synced delivery tasks not yet marked complete.",
  unit: "count",
  timeGrain: "as_of_now",
  valueKind: "DERIVED_VALUE",
  formulaId: "count_incomplete_tasks",
  formulaVersion: "v1",
  formulaDescription: "Count of tasks with completed = false.",
  authorityCapabilityClass: "tasks",
  dependsOnMetricIds: [],
  // A count, not a dollar amount — no exposure classification applies.
  exposureType: null,
};

export const METRIC_CATALOG: readonly MetricDefinition[] = [
  ACCOUNTS_RECEIVABLE,
  OVERDUE_RECEIVABLE_EXPOSURE,
  PIPELINE_VALUE,
  CASH_COLLECTED_RECENT,
  OPEN_TASK_BACKLOG,
];

/** Resolves a metric id back to its definition — the real lookup a UI
 * rendering a `MetricValue` it was handed uses to show the human-readable
 * name/description, never a hardcoded switch on `metricId` strings. */
export function getMetricDefinition(metricId: string): MetricDefinition | null {
  return METRIC_CATALOG.find((metric) => metric.id === metricId) ?? null;
}

/**
 * Every catalog metric for a concept — `[]`, honestly, for a concept with
 * no real formula yet (see this file's own doc comment), never fabricated.
 *
 * No production caller today — `BusinessMetricsPanel` renders the flat
 * `metrics` list `computeBusinessMetrics` already returns and resolves
 * each one's definition via `getMetricDefinition`; nothing yet groups
 * metrics by concept. Kept real and tested (not deleted) for whenever a
 * "show every metric behind this concept" view is needed — found unwired
 * in a dead-code audit this session and disclosed here rather than left
 * undocumented.
 */
export function getMetricsForConcept(
  concept: SemanticConcept,
): readonly MetricDefinition[] {
  return METRIC_CATALOG.filter((metric) => metric.concept === concept);
}
