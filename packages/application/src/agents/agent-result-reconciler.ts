import { randomUUID } from "node:crypto";

import {
  combineSpecialistConfidence,
  type IntelligenceFinding,
} from "@signaldesk/intelligence";
import type { AgentTaskResult, CardSeverity } from "@signaldesk/schemas";

const SEVERITY_RANK: Record<CardSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function maxSeverity(findings: readonly IntelligenceFinding[]): CardSeverity {
  return findings.reduce<CardSeverity>(
    (max, finding) =>
      SEVERITY_RANK[finding.severity] > SEVERITY_RANK[max]
        ? finding.severity
        : max,
    "info",
  );
}

// One entry per real investigation domain's finding type (ADR 0064
// generalized this from a hardcoded 3-way if/else to a data-driven list —
// adding a domain here is now the only change a future one needs, never a
// combinatorial branch). `label` is the plain business word used in the
// title; the singular form doubles as "<Label> risk investigation" when
// exactly one domain is present.
const DOMAIN_TITLE_LABELS: ReadonlyArray<{
  readonly findingType: string;
  readonly label: string;
}> = [
  { findingType: "invoice.overdue", label: "finance" },
  { findingType: "task.overdue", label: "delivery" },
  { findingType: "ticket.stuck", label: "ticket" },
  { findingType: "lead.follow_up_risk", label: "lead" },
  { findingType: "goal.at_risk", label: "goal" },
];

function joinWithAnd(labels: readonly string[]): string {
  if (labels.length === 1) {
    return labels[0]!;
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function buildTitle(citedFindings: readonly IntelligenceFinding[]): string {
  const presentLabels = DOMAIN_TITLE_LABELS.filter((entry) =>
    citedFindings.some((finding) => finding.type === entry.findingType),
  ).map((entry) => entry.label);

  if (presentLabels.length === 0) {
    return "Agent investigation";
  }

  if (presentLabels.length === 1) {
    const label = presentLabels[0]!;
    const adjective = label === "finance" ? "Financial" : capitalize(label);
    return `${adjective} risk investigation`;
  }

  return `${capitalize(joinWithAnd(presentLabels))} risk investigation`;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

function confidenceLabel(confidence: number): "low" | "medium" | "high" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

export interface ReconciliationOutcome {
  /** `null` is honest abstention — never a fabricated recommendation. */
  readonly finding: IntelligenceFinding | null;
  /**
   * Surfaced separately from `finding.confidence` because the caller
   * (`run-agent-investigation.ts`, apps/web) persists this on the
   * `agent_collaborations` row even when the confidence number alone
   * wouldn't reveal that specialists actually disagreed.
   */
  readonly contradictionsDetected: boolean;
}

/**
 * Merges N specialist results into one honest, customer-facing
 * recommendation — or, when nothing usable survives, `finding: null`.
 * Abstention is always preferred over a fabricated recommendation (mission:
 * "an LLM must not... invent missing business facts when explicit
 * abstention is safer").
 *
 * A result is dropped, not trusted, if it cites evidence ids the source
 * findings never actually offered — the concrete defense against a
 * malformed or hallucinated result (Agent Fabric adversarial case
 * "malformed result"). Confidence is combined via
 * `combineSpecialistConfidence` (`@signaldesk/intelligence`), which flags
 * and penalizes real disagreement rather than averaging it away silently.
 *
 * Deliberately does NOT synthesize a combined `financialContext`: the two
 * capabilities span different financial concepts (receivables vs. delivery
 * risk), and this app's own rule is that distinct financial categories
 * "must never be summed into one misleading total figure."
 */
export function reconcileSpecialistResults(
  results: readonly AgentTaskResult[],
  sourceFindings: readonly IntelligenceFinding[],
): ReconciliationOutcome {
  const knownFindingIds = new Set(sourceFindings.map((finding) => finding.id));
  const trustworthy = results.filter(
    (result) =>
      result.status === "completed" &&
      result.evidenceIds.length > 0 &&
      result.evidenceIds.every((id) => knownFindingIds.has(id)),
  );

  if (trustworthy.length === 0) {
    return { finding: null, contradictionsDetected: false };
  }

  const citedFindingIds = new Set(
    trustworthy.flatMap((result) => result.evidenceIds),
  );
  const citedFindings = sourceFindings.filter((finding) =>
    citedFindingIds.has(finding.id),
  );

  const combined = combineSpecialistConfidence(trustworthy);

  if (citedFindings.length === 0) {
    return {
      finding: null,
      contradictionsDetected: combined.contradictionsDetected,
    };
  }

  const claims = Array.from(
    new Set(trustworthy.flatMap((result) => result.claims)),
  );
  const recommendation = trustworthy
    .map((result) => result.recommendation)
    .find((value): value is string => Boolean(value));
  const evidence = citedFindings.flatMap((finding) => finding.evidence);

  // The reconciled finding must report the WORST (oldest) freshness across
  // every cited finding, not just the first one — a reconciliation citing a
  // fresh invoice finding and a stale task finding must surface as stale
  // overall, or a reader would trust the combined claim as fresher than its
  // least-fresh input actually is. `asOf` (not the bucketed `status`) is the
  // comparison key since it's what `status` is itself derived from.
  const staleFreshness = citedFindings.reduce((oldest, finding) =>
    finding.freshness.asOf.getTime() < oldest.freshness.asOf.getTime()
      ? finding
      : oldest,
  ).freshness;

  const finding: IntelligenceFinding = {
    id: `agent-investigation:${randomUUID()}`,
    type: "agent.investigation",
    title: buildTitle(citedFindings),
    summary:
      claims.length > 0
        ? claims.join(" ")
        : (recommendation ?? "Specialists reviewed current findings."),
    severity: maxSeverity(citedFindings),
    confidence: combined.confidence,
    evidence,
    freshness: staleFreshness,
    explanation: {
      trigger: "Specialist agents interpreted current real findings.",
      confidence: confidenceLabel(combined.confidence),
    },
    ...(recommendation
      ? { recommendedActionTypes: ["create_internal_task"] as const }
      : {}),
    detectedAt: new Date(),
    generatedBy: "agent",
  };

  return { finding, contradictionsDetected: combined.contradictionsDetected };
}
