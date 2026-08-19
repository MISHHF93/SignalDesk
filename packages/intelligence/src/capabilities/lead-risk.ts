import type {
  IntelligenceContext,
  IntelligenceCapability,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { formatHours, freshnessStatus } from "../format";
import { getLeadAttention } from "../leadAttention";

/**
 * Financial framing of the same untouched-lead signal `stuck.ts` reports
 * operationally: "how much pipeline value is at risk of stalling."
 */
export const leadRiskIntelligence: IntelligenceCapability = {
  id: "lead-risk",
  description: "Estimates pipeline value at risk from an unresponded lead.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const { lead, now, highValueThresholdCents, workingDaysBitmask, timeZone } =
      context;

    if (!lead) {
      return [];
    }

    const attention = getLeadAttention(
      lead,
      now,
      highValueThresholdCents,
      workingDaysBitmask,
      timeZone,
    );

    if (!attention.requiresAttention) {
      return [];
    }

    const { signal } = attention;
    const elapsedLabel = formatHours(signal.elapsedHours);
    const thresholdLabel = formatHours(signal.thresholdHours);

    const finding: IntelligenceFinding = {
      id: `lead-risk:${lead.organizationId}:${lead.id}`,
      type: "lead.follow_up_risk",
      entity: { kind: "lead", id: lead.id },
      title: `${lead.companyName} opportunity at risk`,
      summary:
        "This opportunity exceeded its normal follow-up window with no recorded contact, putting its pipeline value at risk of stalling.",
      severity: signal.severity,
      confidence: CONFIDENCE_DETERMINISTIC_RULE,
      ...(lead.owner
        ? { owner: { id: lead.owner.id, name: lead.owner.name } }
        : {}),
      financialContext: {
        label: "Pipeline value",
        amountCents: signal.businessImpactCents,
        currency: signal.currency,
      },
      evidence: signal.evidence.map((reference) => ({ ...reference })),
      freshness: {
        asOf: lead.source.lastSyncedAt,
        status: freshnessStatus(attention.sourceFreshnessMinutes),
      },
      explanation: {
        trigger: `Opportunity exceeded its ${thresholdLabel}-hour follow-up window with no recorded contact.`,
        observedValue: `${elapsedLabel} hours elapsed`,
        expectedBaseline: `${thresholdLabel}-hour response threshold`,
        confidence: "high",
      },
      recommendedActionTypes: ["create_internal_task"],
      detectedAt: now,
    };

    return [finding];
  },
};
