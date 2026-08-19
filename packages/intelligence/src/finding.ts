import type { SourceReference } from "@business-dashboard/domain";
import type {
  CardExplanation,
  CardSeverity,
  DataFreshness,
  EntityReference,
  FinancialContext,
  OwnerReference,
} from "@business-dashboard/schemas";

/**
 * The kinds of findings the Intelligence Core can currently produce. Each
 * capability owns a narrow slice of this union; adding a new finding type
 * means adding both the capability that produces it and, if it should be
 * user-visible, a mapping to a registered `CardType` in the orchestrator's
 * dashboard composition step (see `@business-dashboard/application`).
 */
export type IntelligenceType =
  | "lead.untouched"
  | "lead.follow_up_risk"
  | "integration.unconnected"
  | "lead.ownership_gap"
  | "invoice.overdue"
  | "task.overdue";

/**
 * A capability's raw detection result — evidence, not a UI decision. The AI
 * Business Node prioritizes and composes findings into `IntelligenceCard`s;
 * a capability never decides layout, priority number, or final action
 * proposals itself (mission "engines produce evidence, not final UI").
 */
export interface IntelligenceFinding {
  readonly id: string;
  readonly type: IntelligenceType;
  readonly entity?: EntityReference;
  readonly title: string;
  readonly summary: string;
  readonly severity: CardSeverity;
  /** 0–1. Deterministic rules report a fixed high confidence by convention; only model-inferred findings would vary. */
  readonly confidence: number;
  readonly owner?: OwnerReference;
  readonly financialContext?: FinancialContext;
  readonly evidence: readonly SourceReference[];
  readonly freshness: DataFreshness;
  readonly explanation: CardExplanation;
  readonly recommendedActionTypes?: readonly "create_internal_task"[];
  readonly detectedAt: Date;
}

export interface PrioritizedFinding extends IntelligenceFinding {
  readonly priorityScore: number;
  readonly priorityReason: readonly string[];
}
