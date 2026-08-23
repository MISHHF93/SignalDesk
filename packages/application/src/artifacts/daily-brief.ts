import type { PrioritizedFinding } from "@signaldesk/intelligence";

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

/**
 * A minimal, real first slice of the "Executive Brief" proposal's "Since
 * You Left" variant (`docs/product-vision-backlog.md`) — not model-
 * generated narrative, a deterministic diff of real finding IDs. This app
 * has no per-user visit-history tracking (README's own disclosed gap), so
 * rather than invent that infrastructure, "since you left" is defined as
 * "since your last Daily Brief" — the org's most recent `daily_brief`
 * artifact already persists exactly the finding-id set needed to diff
 * against, with no new schema. Finding ids are deterministic
 * (`{capabilityId}:{organizationId}:{entityId}`, see every
 * `IntelligenceCapability`), so the same real-world issue keeps the same
 * id across two runs — comparing two id sets is a genuine, evidence-backed
 * diff, not a guess.
 */

// Kept in sync with packages/intelligence/src/registry.ts's registered
// capability ids — this map has already gone stale once (missing
// goal-variance/message-follow-up/ticket-risk after they were added),
// silently falling back to the raw capability id in user-facing "Since
// You Left" text rather than crashing, which is exactly why it went
// unnoticed until checked directly. `stuck` is kept for the same
// historical-compatibility reason `card_feedback_card_type_allowed`
// keeps it (packages/persistence/src/schema.ts) — real prior "Since You
// Left" briefs may reference `stuck:`-prefixed finding ids from before
// Phase 1's fusion retired it as a live capability.
const CAPABILITY_LABELS: Record<string, string> = {
  stuck: "stuck lead",
  "lead-risk": "at-risk lead",
  "integration-health": "integration health issue",
  ownership: "ownership gap",
  "overdue-invoice": "overdue invoice",
  "overdue-task": "overdue task",
  "payment-received": "payment received",
  "goal-variance": "goal at risk",
  "message-follow-up": "message awaiting reply",
  "ticket-risk": "stuck support ticket",
};

function describeResolvedId(id: string): string {
  const capabilityId = id.split(":")[0] ?? id;
  return CAPABILITY_LABELS[capabilityId] ?? capabilityId;
}

function pluralizeLabel(label: string, count: number): string {
  if (count === 1) {
    return label;
  }

  return label.endsWith("y") && !/[aeiou]y$/i.test(label)
    ? `${label.slice(0, -1)}ies`
    : `${label}s`;
}

export interface PreviousBriefReference {
  readonly id: string;
  readonly generatedAt: Date;
  readonly sourceFindingIds: readonly string[];
}

export interface SinceYouLeftBriefContent {
  readonly title: string;
  readonly content: string;
  readonly structuredData: {
    readonly mode: "since_you_left";
    readonly newCount: number;
    readonly resolvedCount: number;
    readonly comparedToBriefId: string | null;
    readonly comparedToBriefGeneratedAt: string | null;
  };
  readonly sourceFindingIds: readonly string[];
}

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function generateSinceYouLeftBrief(
  currentFindings: readonly PrioritizedFinding[],
  previousBrief: PreviousBriefReference | null,
  now: Date,
): SinceYouLeftBriefContent {
  const title = `Since You Left — ${DATE_FORMAT.format(now)}`;
  const sourceFindingIds = currentFindings.map((finding) => finding.id);

  if (!previousBrief) {
    const lines = [
      "No prior brief exists yet to compare against — showing everything currently open.",
      "",
      ...currentFindings.map(
        (finding) =>
          `- [${finding.severity.toUpperCase()}] ${finding.title} — ${finding.summary}`,
      ),
    ];

    return {
      title,
      content:
        currentFindings.length === 0
          ? "No prior brief exists yet, and nothing needs attention right now."
          : lines.join("\n"),
      structuredData: {
        mode: "since_you_left",
        newCount: currentFindings.length,
        resolvedCount: 0,
        comparedToBriefId: null,
        comparedToBriefGeneratedAt: null,
      },
      sourceFindingIds,
    };
  }

  const previousIds = new Set(previousBrief.sourceFindingIds);
  const currentIds = new Set(sourceFindingIds);
  const newFindings = currentFindings.filter(
    (finding) => !previousIds.has(finding.id),
  );
  const resolvedIds = previousBrief.sourceFindingIds.filter(
    (id) => !currentIds.has(id),
  );

  const resolvedCountsByLabel = new Map<string, number>();
  for (const id of resolvedIds) {
    const label = describeResolvedId(id);
    resolvedCountsByLabel.set(
      label,
      (resolvedCountsByLabel.get(label) ?? 0) + 1,
    );
  }

  const lines: string[] = [
    `Since your last brief (${TIME_FORMAT.format(previousBrief.generatedAt)}):`,
    "",
  ];

  if (newFindings.length === 0 && resolvedIds.length === 0) {
    lines.push("Nothing changed since your last brief.");
  } else {
    if (newFindings.length > 0) {
      lines.push(
        `${newFindings.length} new item${newFindings.length === 1 ? "" : "s"} surfaced:`,
      );
      for (const finding of newFindings) {
        lines.push(
          `- [${finding.severity.toUpperCase()}] ${finding.title} — ${finding.summary}`,
        );
      }
      lines.push("");
    }

    if (resolvedIds.length > 0) {
      lines.push(
        `${resolvedIds.length} item${resolvedIds.length === 1 ? "" : "s"} resolved:`,
      );
      for (const [label, count] of resolvedCountsByLabel) {
        lines.push(`- ${count} ${pluralizeLabel(label, count)}`);
      }
    }
  }

  return {
    title,
    content: lines.join("\n").trimEnd(),
    structuredData: {
      mode: "since_you_left",
      newCount: newFindings.length,
      resolvedCount: resolvedIds.length,
      comparedToBriefId: previousBrief.id,
      comparedToBriefGeneratedAt: previousBrief.generatedAt.toISOString(),
    },
    sourceFindingIds,
  };
}
