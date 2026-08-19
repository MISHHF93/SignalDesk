import type { PrioritizedFinding } from "@business-dashboard/intelligence";

import {
  countFindingsBySeverity,
  type SeverityCounts,
} from "../severity-counts";

/**
 * The first real Artifact type: a Daily Brief assembled entirely from the
 * same prioritized findings the command center already renders as cards —
 * a real rollup of real data, not model-generated prose (this app has no
 * AI model provider yet). `generateDailyBrief` is pure and synchronous,
 * matching `composeCards`'s own "the AI Business Node's composition step
 * is pure" precedent — persistence and orchestration stay in the caller.
 */

export interface DailyBriefContent {
  readonly title: string;
  readonly content: string;
  readonly structuredData: SeverityCounts;
  readonly sourceFindingIds: readonly string[];
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function generateDailyBrief(
  findings: readonly PrioritizedFinding[],
  now: Date,
): DailyBriefContent {
  const severityCounts = countFindingsBySeverity(findings);
  const { criticalCount, highCount, mediumCount, lowCount } = severityCounts;

  const title = `Daily Brief — ${DATE_FORMAT.format(now)}`;

  const lines: string[] = [];

  if (findings.length === 0) {
    lines.push("Nothing needs attention right now.");
  } else {
    const severityParts = [
      criticalCount > 0 ? `${criticalCount} critical` : null,
      highCount > 0 ? `${highCount} high` : null,
      mediumCount > 0 ? `${mediumCount} medium` : null,
      lowCount > 0 ? `${lowCount} low` : null,
    ].filter((part): part is string => part !== null);

    const isSingular = findings.length === 1;
    lines.push(
      `${findings.length} item${isSingular ? "" : "s"} need${isSingular ? "s" : ""} attention today${
        severityParts.length > 0 ? `: ${severityParts.join(", ")}` : ""
      }.`,
    );
    lines.push("");

    for (const finding of findings) {
      lines.push(
        `- [${finding.severity.toUpperCase()}] ${finding.title} — ${finding.summary}`,
      );
    }
  }

  return {
    title,
    content: lines.join("\n"),
    structuredData: severityCounts,
    sourceFindingIds: findings.map((finding) => finding.id),
  };
}
