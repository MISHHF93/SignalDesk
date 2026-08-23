/**
 * Dependency Intelligence (Prompt 23, docs/product-vision-backlog.md, ADR
 * 0036) — a formal, deliberately narrow first slice of the proposed
 * `DependencyType`/`RootCauseCandidate`/`ImpactPath` model. Only one real
 * `DependencyType` exists today because only one real relationship this
 * app's already-synced data implies (`Payment.invoiceAllocations`,
 * `@signaldesk/domain`) — widen this the day a second real relationship
 * exists (e.g. Asana task dependencies, once that connector syncs them),
 * not speculatively.
 */
export type DependencyType = "payment_settles_invoice";

/**
 * The full confidence vocabulary Prompt 23 names — declared honestly
 * ahead of what's real, the same "anticipate the real shape" choice
 * `GoalStatus` (`@signaldesk/goals`) already made. Only `CONFIRMED_DEPENDENCY`
 * is ever produced today: every dependency this package resolves is an
 * exact external-id match within the same source system, never a
 * probabilistic or correlation-based inference. `OBSERVED_ASSOCIATION`/
 * `POSSIBLE_CONTRIBUTOR`/`ROOT_CAUSE_CANDIDATE` stay unused until a real
 * detector produces one — correlation is never labeled as causal
 * evidence here (Prompt 23's own explicit rule).
 */
export type DependencyConfidence =
  | "CONFIRMED_DEPENDENCY"
  | "OBSERVED_ASSOCIATION"
  | "POSSIBLE_CONTRIBUTOR"
  | "ROOT_CAUSE_CANDIDATE";

export interface DependencyEntityRef {
  readonly kind: "payment" | "invoice";
  readonly id: string;
}

/** One real, evidence-backed edge between two canonical Business Graph
 * entities — never a summary count, always traceable back to the exact
 * records that produced it (`sourceEvidence`). */
export interface Dependency {
  readonly id: string;
  readonly type: DependencyType;
  readonly confidence: DependencyConfidence;
  readonly from: DependencyEntityRef;
  readonly to: DependencyEntityRef;
  readonly amountCents: number;
  readonly currency: string;
  readonly observedAt: Date;
}
