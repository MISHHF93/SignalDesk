import { normalizeEntityName } from "@signaldesk/domain";

import type {
  IntelligenceContext,
  IntelligenceCapability,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { freshnessStatus } from "../format";
import { getLeadAttention } from "../leadAttention";

/**
 * Fires for every lead in `context.leads` that genuinely has no assigned
 * owner. A real HubSpot connector exists (ADR 0008), so real leads are
 * ingested once one is connected — but `mapHubSpotDealToSourceLeadRecord`
 * never calls the Associations/Contacts API, so `lead.owner` is `null`
 * for every real ingested HubSpot lead today. This is expected to fire on
 * essentially every real connected lead until a future contact-enrichment
 * phase populates ownership at ingest — not a bug in this capability
 * itself. (Frontend/backend audit, 2026-08-21: this finding was firing
 * correctly but had no card mapping, so it was silently dropped before
 * ever reaching the UI — fixed in `dashboard-composition.ts`, not here.)
 *
 * Loops over every candidate lead rather than one representative record —
 * unlike `lead-risk`, this doesn't filter by follow-up threshold at all
 * (a lead with no owner is worth flagging regardless of how recently it
 * was created), so it evaluates the full `leads` set, not just the ones
 * `getLeadAttention` would call "at risk."
 */
export const ownershipIntelligence: IntelligenceCapability = {
  id: "ownership",
  description: "Detects leads with no assigned owner.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const {
      leads,
      now,
      highValueThresholdCents,
      workingDaysBitmask,
      timeZone,
    } = context;
    const findings: IntelligenceFinding[] = [];

    for (const lead of leads) {
      if (lead.owner !== null) {
        continue;
      }

      const attention = getLeadAttention(
        lead,
        now,
        highValueThresholdCents,
        workingDaysBitmask,
        timeZone,
      );

      findings.push({
        id: `ownership:${lead.organizationId}:${lead.id}`,
        type: "lead.ownership_gap",
        entity: { kind: "lead", id: lead.id },
        correlationName: normalizeEntityName(lead.companyName),
        title: `${lead.contactName} at ${lead.companyName} has no owner`,
        summary:
          "This lead has no assigned owner, so no one is accountable for its next step.",
        severity: "medium",
        confidence: CONFIDENCE_DETERMINISTIC_RULE,
        evidence: [{ ...lead.source }],
        freshness: {
          asOf: lead.source.lastSyncedAt,
          status: freshnessStatus(attention.sourceFreshnessMinutes),
        },
        explanation: {
          trigger: "No owner is recorded for this lead.",
          expectedBaseline: "Every active lead should have an assigned owner.",
          confidence: "high",
        },
        recommendedActionTypes: ["create_internal_task"],
        detectedAt: now,
      });
    }

    return findings;
  },
};
