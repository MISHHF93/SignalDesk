import type { PrioritizedFinding } from "@business-dashboard/intelligence";

export interface SeverityCounts {
  readonly totalCount: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly infoCount: number;
}

function countBySeverity(
  findings: readonly PrioritizedFinding[],
  severity: PrioritizedFinding["severity"],
): number {
  return findings.filter((finding) => finding.severity === severity).length;
}

/**
 * Shared by the Daily Brief artifact and the Business Snapshot pulse —
 * both need "how many findings at each severity," and previously only
 * the Daily Brief had this logic, private to itself.
 */
export function countFindingsBySeverity(
  findings: readonly PrioritizedFinding[],
): SeverityCounts {
  return {
    totalCount: findings.length,
    criticalCount: countBySeverity(findings, "critical"),
    highCount: countBySeverity(findings, "high"),
    mediumCount: countBySeverity(findings, "medium"),
    lowCount: countBySeverity(findings, "low"),
    infoCount: countBySeverity(findings, "info"),
  };
}
