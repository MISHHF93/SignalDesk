import type { SemanticConcept } from "./concepts";

/**
 * A human-readable description of which canonical Business Graph field
 * feeds which semantic concept — the `SemanticField` layer. Deliberately a
 * small descriptive catalog, not a generic runtime reflection system: the
 * real Business Graph has exactly four canonical entities (ADR 0003/0014),
 * each already a concrete TypeScript interface in `@signaldesk/domain`.
 * This documents that existing mapping for the UI/lineage rather than
 * replacing it with a parallel entity/field metamodel nothing needs yet.
 */
export interface SemanticField {
  readonly id: string;
  readonly description: string;
  readonly measures: SemanticConcept | null;
}

/** The `SemanticEntity` layer — one entry per canonical `@signaldesk/domain` type. */
export interface SemanticEntity {
  readonly id: string;
  readonly domainType: string;
  readonly description: string;
  readonly fields: readonly SemanticField[];
}

/**
 * No production caller today — `BusinessMetricsPanel` (the Semantic
 * Layer's one real UI surface so far) renders `MetricValue`s resolved via
 * `getMetricDefinition`, never this entity/field catalog. Kept real and
 * tested (not deleted) for whenever a lineage view needs to show "which
 * canonical field feeds this concept," not just "which metric produced
 * this number" — found unwired in a dead-code audit this session and
 * disclosed here rather than left undocumented.
 */
export const SEMANTIC_ENTITIES: readonly SemanticEntity[] = [
  {
    id: "lead",
    domainType: "Lead",
    description:
      "A sales opportunity synced from a connected CRM (today: HubSpot deals).",
    fields: [
      {
        id: "lead.valueCents",
        description: "The opportunity's own recorded value.",
        measures: "Pipeline",
      },
    ],
  },
  {
    id: "invoice",
    domainType: "Invoice",
    description:
      "An accounting receivable synced from a connected accounting system (today: QuickBooks).",
    fields: [
      {
        id: "invoice.amountCents",
        description:
          "The invoice's own billed amount, while its status is open.",
        measures: "AccountsReceivable",
      },
    ],
  },
  {
    id: "payment",
    domainType: "Payment",
    description:
      "A payment observed by a connected accounting/payments system (today: QuickBooks).",
    fields: [
      {
        id: "payment.amountCents",
        description: "The payment's own recorded amount.",
        measures: "Cash",
      },
    ],
  },
  {
    id: "task",
    domainType: "Task",
    description:
      "A delivery task synced from a connected project/task system (today: Asana).",
    fields: [
      {
        id: "task.completed",
        description: "Whether the task has been marked done at its source.",
        measures: "Backlog",
      },
    ],
  },
];
