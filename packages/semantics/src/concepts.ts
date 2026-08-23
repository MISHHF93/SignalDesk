/**
 * The closed vocabulary every `SemanticMetric` — and later, every Goal
 * (Prompt 22), Financial Exposure object (Prompt 26), and Commitment
 * (Prompt 25) — refers to by concept rather than restating its own
 * definition. Declared in full now rather than grown one concept at a
 * time: the same "anticipate the real shape honestly" choice
 * `ArtifactType`/`Invoice.status` already made in `@signaldesk/schemas`,
 * because later prompts in this same sequence
 * (`docs/product-vision-backlog.md`) name these exact concepts before
 * they have metrics of their own — e.g. Goals' "project margin above 35%"
 * needs `Margin` to already mean one specific thing platform-wide, not be
 * invented ad hoc when that prompt is built.
 *
 * This list is the vocabulary, not a claim that every concept has a live
 * number today — see `CATALOG_CONCEPTS` in `catalog.ts` for the honest
 * subset actually computed, and `getMetricsForConcept` for a query that
 * returns `[]` rather than fabricating one for the rest.
 */
export type SemanticConcept =
  | "Revenue"
  | "Pipeline"
  | "Cash"
  | "AccountsReceivable"
  | "WorkInProgress"
  | "Capacity"
  | "Utilization"
  | "Margin"
  | "CustomerValue"
  | "OpportunityValue"
  | "Commitment"
  | "Deadline"
  | "Risk"
  | "Exposure"
  | "Backlog"
  | "ResponseTime"
  | "SLA"
  | "Ownership";
