import type {
  IntelligenceContext,
  IntelligenceCapability,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { freshnessStatus } from "../format";
import { getLeadAttention } from "../leadAttention";

/**
 * Fires only when a lead genuinely has no assigned owner; with no real
 * connector yet, `context.lead` is always `null` today, so this correctly
 * produces no findings — that is the honest result, not a gap. See the
 * colocated test for a fixture that does trigger it.
 */
export const ownershipIntelligence: IntelligenceCapability = {
  id: "ownership",
  description: "Detects leads with no assigned owner.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const { lead, now, highValueThresholdCents, workingDaysBitmask, timeZone } =
      context;

    if (!lead || lead.owner !== null) {
      return [];
    }

    const attention = getLeadAttention(
      lead,
      now,
      highValueThresholdCents,
      workingDaysBitmask,
      timeZone,
    );

    const finding: IntelligenceFinding = {
      id: `ownership:${lead.organizationId}:${lead.id}`,
      type: "lead.ownership_gap",
      entity: { kind: "lead", id: lead.id },
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
      detectedAt: now,
    };

    return [finding];
  },
};
