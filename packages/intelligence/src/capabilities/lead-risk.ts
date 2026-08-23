import { normalizeEntityName } from "@signaldesk/domain";

import type {
  IntelligenceContext,
  IntelligenceCapability,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { formatHours, freshnessStatus } from "../format";
import { getLeadAttention } from "../leadAttention";

/**
 * The untouched-lead signal — both the operational framing ("what should
 * have happened by now but hasn't") and the financial framing ("how much
 * pipeline value is at risk of stalling") in one finding. Previously two
 * separate registered capabilities (this one and a since-retired
 * `stuckIntelligence` in `stuck.ts`) independently wrapped the same
 * `getLeadAttention` result into two `IntelligenceFinding`s, producing two
 * cards for one real situation — a real, disclosed duplication (issue 13,
 * `docs/25-issue-audit.md`: "Signal Duplication/Fusion"). Fused here
 * rather than deduplicated downstream: `summary` now uses the real,
 * specific `signal.explanation` the retired capability surfaced (not this
 * capability's own previous generic templated sentence), so fusion is a
 * genuine quality improvement, not just a removal.
 *
 * Evaluates every lead in `context.leads`, not just one — unlike
 * `evaluateOverdueInvoice`'s date-comparison, `evaluateUntouchedLead`'s
 * threshold rule can't be expressed as a SQL filter (it needs the
 * organization's working-days bitmask/timezone), so `leads` is a
 * candidate set and this loop is what actually decides which leads are at
 * risk — mirrors `overdueInvoiceIntelligence`'s own loop-and-filter shape.
 */
export const leadRiskIntelligence: IntelligenceCapability = {
  id: "lead-risk",
  description: "Estimates pipeline value at risk from an unresponded lead.",
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
      const attention = getLeadAttention(
        lead,
        now,
        highValueThresholdCents,
        workingDaysBitmask,
        timeZone,
      );

      if (!attention.requiresAttention) {
        continue;
      }

      const { signal } = attention;
      const elapsedLabel = formatHours(signal.elapsedHours);
      const thresholdLabel = formatHours(signal.thresholdHours);

      findings.push({
        id: `lead-risk:${lead.organizationId}:${lead.id}`,
        type: "lead.follow_up_risk",
        entity: { kind: "lead", id: lead.id },
        correlationName: normalizeEntityName(lead.companyName),
        title: `${lead.companyName} opportunity at risk`,
        summary: signal.explanation,
        severity: signal.severity,
        confidence: CONFIDENCE_DETERMINISTIC_RULE,
        ...(lead.owner
          ? { owner: { id: lead.owner.id, name: lead.owner.name } }
          : {}),
        financialContext: {
          label: "Pipeline value",
          exposureType: "POTENTIAL_EXPOSURE",
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
      });
    }

    return findings;
  },
};
