import type {
  IntelligenceCapability,
  IntelligenceContext,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { freshnessStatus } from "../format";

/**
 * "What came in" — one of the four universal operating questions this
 * product exists to answer. Unlike every other real capability (all
 * risk-oriented: overdue, stuck, ungoverned), a payment isn't a problem
 * to evaluate — there's no rule to run, just a real fact worth
 * surfacing, so this produces one `severity: "info"` finding per payment
 * in `context.recentPayments` with no domain-layer evaluator behind it.
 */
export const paymentReceivedIntelligence: IntelligenceCapability = {
  id: "payment-received",
  description: "Surfaces recently received payments.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const { recentPayments, now } = context;
    const findings: IntelligenceFinding[] = [];

    for (const payment of recentPayments) {
      const sourceFreshnessMinutes = Math.max(
        0,
        Math.floor(
          (now.getTime() - payment.source.lastSyncedAt.getTime()) / 60_000,
        ),
      );

      findings.push({
        id: `payment-received:${payment.organizationId}:${payment.id}`,
        type: "payment.received",
        entity: { kind: "payment", id: payment.id },
        title: `Payment received from ${payment.customerName}`,
        summary: `A payment of ${(payment.amountCents / 100).toFixed(2)} ${payment.currency} was received from ${payment.customerName}.`,
        severity: "info",
        confidence: CONFIDENCE_DETERMINISTIC_RULE,
        financialContext: {
          label: "Confirmed revenue",
          exposureType: "CONFIRMED_AMOUNT",
          amountCents: payment.amountCents,
          currency: payment.currency,
        },
        evidence: [{ ...payment.source }],
        freshness: {
          asOf: payment.source.lastSyncedAt,
          status: freshnessStatus(sourceFreshnessMinutes),
        },
        explanation: {
          trigger: "A payment was recorded against the connected account.",
          observedValue: `${(payment.amountCents / 100).toFixed(2)} ${payment.currency}`,
          expectedBaseline:
            "Not applicable — this confirms something good happened, it isn't flagging a problem.",
          confidence: "high",
        },
        recommendedActionTypes: [],
        detectedAt: now,
      });
    }

    return findings;
  },
};
