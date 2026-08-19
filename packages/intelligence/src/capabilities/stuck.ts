import type {
  IntelligenceContext,
  IntelligenceCapability,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { formatHours, freshnessStatus } from "../format";
import { getLeadAttention } from "../leadAttention";

/**
 * Operational framing of the untouched-lead signal: "what should have
 * happened by now but hasn't." See `lead-risk.ts` for the financial framing
 * of the same underlying signal.
 */
export const stuckIntelligence: IntelligenceCapability = {
  id: "stuck",
  description: "Detects leads that have exceeded their expected response time.",
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
      id: `stuck:${lead.organizationId}:${lead.id}`,
      type: "lead.untouched",
      entity: { kind: "lead", id: lead.id },
      title: `${lead.contactName} at ${lead.companyName}`,
      summary: signal.explanation,
      severity: signal.severity,
      confidence: CONFIDENCE_DETERMINISTIC_RULE,
      ...(lead.owner
        ? { owner: { id: lead.owner.id, name: lead.owner.name } }
        : {}),
      evidence: signal.evidence.map((reference) => ({ ...reference })),
      freshness: {
        asOf: lead.source.lastSyncedAt,
        status: freshnessStatus(attention.sourceFreshnessMinutes),
      },
      explanation: {
        trigger: `No interaction within ${thresholdLabel} hours of creation.`,
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
