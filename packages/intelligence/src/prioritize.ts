import type { CardSeverity } from "@signaldesk/schemas";

import type { IntelligenceFinding, PrioritizedFinding } from "./finding";

/**
 * Documented, deterministic priority weighting — never an opaque score.
 * `priorityScore = severityWeight[severity] + confidence * 10`, so a
 * critical/high-confidence finding tops out near 100 and an info-level
 * catalog fact sits near 10-20.
 */
const SEVERITY_WEIGHT: Record<CardSeverity, number> = {
  critical: 90,
  high: 70,
  medium: 50,
  low: 30,
  info: 10,
};

function priorityScore(finding: IntelligenceFinding): number {
  return Math.round(
    SEVERITY_WEIGHT[finding.severity] + finding.confidence * 10,
  );
}

function priorityReason(finding: IntelligenceFinding): readonly string[] {
  const reasons = [finding.explanation.trigger];

  if (finding.explanation.observedValue) {
    reasons.push(finding.explanation.observedValue);
  }

  if (finding.financialContext) {
    reasons.push(
      `${finding.financialContext.label}: ${(finding.financialContext.amountCents / 100).toLocaleString("en-CA", { style: "currency", currency: finding.financialContext.currency, maximumFractionDigits: 0 })}`,
    );
  }

  return reasons;
}

/**
 * Ranks findings by documented business-importance weighting (§15-16 of the
 * AI Business Node mission: "ranking should not rely entirely on free-form
 * model intuition"). Ties keep their original (registry) order.
 */
export function prioritizeFindings(
  findings: readonly IntelligenceFinding[],
): readonly PrioritizedFinding[] {
  return findings
    .map((finding) => ({
      ...finding,
      priorityScore: priorityScore(finding),
      priorityReason: priorityReason(finding),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
