/**
 * Data Quality & Entity Resolution (Prompt 33, docs/product-vision-backlog.md,
 * ADR 0042) — a deliberately narrow first slice. The full proposal names a
 * `DataQualityEngine`/`EntityResolutionEngine` with deterministic
 * identifier matching, probabilistic matching, and a human-reviewed merge
 * workflow. Only the first of those is real today: one deterministic,
 * exact-string cross-provider name match. `POTENTIAL_DUPLICATE_ENTITY` is
 * the only issue type this package ever produces — declared narrowly
 * rather than naming unused future types, unlike `DependencyConfidence`'s
 * pattern, because this prompt's own reality check scoped exactly one
 * check as the first real step, not a wider vocabulary to grow into.
 */
export type DataQualityIssueType = "POTENTIAL_DUPLICATE_ENTITY";

export interface DataQualityEntityRef {
  readonly kind: "lead" | "invoice";
  readonly id: string;
  readonly system: string;
}

/** One real, evidence-backed potential duplicate — never a fabricated or
 * probabilistic guess; always traceable back to the exact two records and
 * the exact string they matched on. No merge action exists yet: this is
 * surfaced for human review only. */
export interface DataQualityIssue {
  readonly id: string;
  readonly type: DataQualityIssueType;
  readonly matchedOn: string;
  readonly entities: readonly [DataQualityEntityRef, DataQualityEntityRef];
  readonly detectedAt: Date;
}
