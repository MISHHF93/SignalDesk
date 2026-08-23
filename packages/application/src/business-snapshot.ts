import type { PrioritizedFinding } from "@signaldesk/intelligence";
import type { IntelligenceCard } from "@signaldesk/schemas";

import {
  countFindingsBySeverity,
  type SeverityCounts,
} from "./severity-counts";

/**
 * Mirrors `@signaldesk/integrations`' real `ConnectorCapabilityClass`
 * union (ADR 0021, superseding the earlier `ConnectorPurpose`), declared
 * locally rather than imported — `packages/application` stays decoupled
 * from the connector-catalog package, the same boundary `IntelligenceContext`
 * already draws (it takes `connectedIntegrationSlugs: readonly string[]`,
 * never a connector definition). The real value from
 * `computeBusinessCoverageByCapability` is structurally compatible with
 * `DomainCoverage` below (same field name, `capabilityClass`, not just the
 * same value union) and can be passed straight through with no mapping at
 * the call site.
 */
export type BusinessDomainCapabilityClass =
  | "identity"
  | "crm"
  | "communication"
  | "calendar"
  | "projects"
  | "tasks"
  | "time"
  | "accounting"
  | "payments"
  | "documents"
  | "contracts"
  | "support"
  | "hr"
  | "ats"
  | "commerce"
  | "inventory"
  | "field-service"
  | "psa"
  | "rmm"
  | "security"
  | "product-analytics"
  | "data-warehouse";

export type DomainCoverageStatus = "none" | "partial" | "connected";

export interface DomainCoverage {
  readonly capabilityClass: BusinessDomainCapabilityClass;
  readonly status: DomainCoverageStatus;
  readonly connectedConnectorNames: readonly string[];
  readonly totalConnectorNames: readonly string[];
}

export interface BusinessCoverageSummary {
  readonly totalDomains: number;
  readonly connectedDomains: number;
  readonly partialDomains: number;
  readonly uncoveredDomains: number;
}

export type SnapshotFreshnessStatus = "fresh" | "aging" | "stale" | "unknown";

export interface SnapshotFreshness {
  readonly status: SnapshotFreshnessStatus;
}

export interface ConnectorHealthSummary {
  readonly slug: string;
  readonly name: string;
  readonly capabilityClass: BusinessDomainCapabilityClass;
  readonly status: "connected" | "not_connected";
  /** A real one-time sync-on-connect exists (HubSpot, QuickBooks, Asana
   * today) — not the same as `status`, which only means "authorized." */
  readonly hasRealSync: boolean;
}

export interface RecentActionSummary {
  readonly eventType: string;
  readonly subjectType: string;
  readonly outcome: string;
  readonly occurredAt: Date;
}

/** Real type, honestly always empty today — no `WhatChangedService` or
 * visit-history persistence exists yet to compute this from. */
export interface MeaningfulChange {
  readonly id: string;
  readonly summary: string;
  readonly occurredAt: Date;
}

/** Real type, honestly always empty today — no approval workflow exists
 * yet (README's "Actions, approvals, and audit trail" row). */
export interface PendingApproval {
  readonly id: string;
  readonly summary: string;
  readonly requestedAt: Date;
}

export interface BusinessContextProfile {
  readonly timezone: string;
  readonly defaultExpectedResponseHours: number;
  readonly highValueThresholdCents: number;
  readonly workingDaysBitmask: number;
}

export type BusinessSnapshotPulse = SeverityCounts;

/**
 * The canonical bounded object the One-Page Command Center renders from.
 * Every field is real; three (`waitingOnMe`, `meaningfulChanges`,
 * `approvals`) are honestly empty because no service backs them yet —
 * see each type's own doc comment. Declaring the full shape now, with
 * real-but-empty values, is the same choice the Artifact status lifecycle
 * and `Invoice.status`'s unused `paid`/`void` states already made: the
 * type is forward-compatible, the runtime value doesn't pretend.
 *
 * `recentActions` is rendered on the command center (`RecentActivityPanel`).
 * `domainHealth`/`coverage`/`connectorHealth` are real and computed but
 * currently rendered only on their own natural detail pages (`/integrations`
 * and `/integrations/[slug]`, via a separate direct call to
 * `computeBusinessCoverageByCapability`/`computeConnectorHealth`, not by
 * reading this snapshot) — carried here mainly so a future command-center
 * summary view doesn't need a second query. `pulse` (severity counts) has
 * no renderer yet — found unwired in a dead-code/wiring audit this
 * session and disclosed here rather than left undocumented.
 */
export interface BusinessSnapshot {
  readonly organizationId: string;
  readonly snapshotId: string;
  readonly generatedAt: Date;
  readonly dataThroughAt: Date;
  readonly coverage: BusinessCoverageSummary;
  readonly freshness: SnapshotFreshness;
  readonly attentionItems: readonly PrioritizedFinding[];
  /**
   * The same composed cards the command center's own initial server
   * render uses (`composeCards`, via `BusinessAttention.cards`) — not a
   * second, divergent computation. Added so a client-side poll of this
   * same snapshot (`/api/business/snapshot`, `useBusinessSnapshot`) can
   * refresh the command center's card list directly, instead of either
   * re-deriving `composeCards` in the browser (duplicating server-only
   * composition logic) or polling a second, parallel endpoint.
   */
  readonly cards: readonly IntelligenceCard[];
  readonly waitingOnMe: readonly PrioritizedFinding[];
  readonly meaningfulChanges: readonly MeaningfulChange[];
  readonly businessContext: BusinessContextProfile;
  readonly approvals: readonly PendingApproval[];
  readonly recentActions: readonly RecentActionSummary[];
  readonly domainHealth: readonly DomainCoverage[];
  readonly connectorHealth: readonly ConnectorHealthSummary[];
  readonly pulse: BusinessSnapshotPulse;
}

export interface AssembleBusinessSnapshotInput {
  readonly organizationId: string;
  readonly snapshotId: string;
  readonly now: Date;
  readonly findings: readonly PrioritizedFinding[];
  readonly cards: readonly IntelligenceCard[];
  readonly businessContext: BusinessContextProfile;
  readonly recentActions: readonly RecentActionSummary[];
  readonly domainHealth: readonly DomainCoverage[];
  readonly connectorHealth: readonly ConnectorHealthSummary[];
}

const FRESHNESS_RANK: Record<SnapshotFreshnessStatus, number> = {
  fresh: 0,
  aging: 1,
  stale: 2,
  unknown: 3,
};

function worstFreshness(
  findings: readonly PrioritizedFinding[],
): SnapshotFreshnessStatus {
  let worst: SnapshotFreshnessStatus = "fresh";
  for (const finding of findings) {
    if (FRESHNESS_RANK[finding.freshness.status] > FRESHNESS_RANK[worst]) {
      worst = finding.freshness.status;
    }
  }
  return worst;
}

/** The oldest "as of" timestamp among current findings — an honest lower
 * bound on how current the underlying data actually is, given no
 * connector has recurring sync yet (every sync is a one-time pull on
 * connect). Falls back to `now` when there are no findings to be stale. */
function earliestAsOf(
  findings: readonly PrioritizedFinding[],
  fallback: Date,
): Date {
  const [first, ...rest] = findings;

  if (!first) {
    return fallback;
  }

  return rest.reduce(
    (earliest, finding) =>
      finding.freshness.asOf < earliest ? finding.freshness.asOf : earliest,
    first.freshness.asOf,
  );
}

function summarizeCoverage(
  domainHealth: readonly DomainCoverage[],
): BusinessCoverageSummary {
  let connectedDomains = 0;
  let partialDomains = 0;
  let uncoveredDomains = 0;

  for (const domain of domainHealth) {
    if (domain.status === "connected") {
      connectedDomains += 1;
    } else if (domain.status === "partial") {
      partialDomains += 1;
    } else {
      uncoveredDomains += 1;
    }
  }

  return {
    totalDomains: domainHealth.length,
    connectedDomains,
    partialDomains,
    uncoveredDomains,
  };
}

/**
 * Assembles the `BusinessSnapshot`. Pure — every input is already-fetched
 * real data; this does no I/O itself, matching `composeCards`/
 * `generateDailyBrief`'s own "assembly is pure, orchestration lives in
 * the caller" precedent. `waitingOnMe`/`meaningfulChanges`/`approvals`
 * are always `[]` — see their types' doc comments for why.
 */
export function assembleBusinessSnapshot(
  input: AssembleBusinessSnapshotInput,
): BusinessSnapshot {
  return {
    organizationId: input.organizationId,
    snapshotId: input.snapshotId,
    generatedAt: input.now,
    dataThroughAt: earliestAsOf(input.findings, input.now),
    coverage: summarizeCoverage(input.domainHealth),
    freshness: { status: worstFreshness(input.findings) },
    attentionItems: input.findings,
    cards: input.cards,
    waitingOnMe: [],
    meaningfulChanges: [],
    businessContext: input.businessContext,
    approvals: [],
    recentActions: input.recentActions,
    domainHealth: input.domainHealth,
    connectorHealth: input.connectorHealth,
    pulse: countFindingsBySeverity(input.findings),
  };
}
