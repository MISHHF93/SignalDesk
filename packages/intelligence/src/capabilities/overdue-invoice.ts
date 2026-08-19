import { evaluateOverdueInvoice } from "@signaldesk/domain";

import type {
  IntelligenceCapability,
  IntelligenceContext,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { freshnessStatus } from "../format";

/**
 * Financial-risk framing of QuickBooks receivables: which unpaid invoices
 * have passed their due date, unlike lead follow-up this evaluates every
 * overdue invoice in `context.overdueInvoices`, not just one — each is an
 * independent risk item (see `IntelligenceContext`'s doc comment).
 */
export const overdueInvoiceIntelligence: IntelligenceCapability = {
  id: "overdue-invoice",
  description: "Detects unpaid invoices that have passed their due date.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const { overdueInvoices, now, highValueThresholdCents } = context;
    const findings: IntelligenceFinding[] = [];

    for (const invoice of overdueInvoices) {
      const signal = evaluateOverdueInvoice(
        invoice,
        now,
        highValueThresholdCents,
      );

      if (!signal) {
        continue;
      }

      const sourceFreshnessMinutes = Math.max(
        0,
        Math.floor(
          (now.getTime() - invoice.source.lastSyncedAt.getTime()) / 60_000,
        ),
      );

      findings.push({
        id: `overdue-invoice:${invoice.organizationId}:${invoice.id}`,
        type: "invoice.overdue",
        entity: { kind: "invoice", id: invoice.id },
        title: `${invoice.customerName} invoice overdue`,
        summary: signal.explanation,
        severity: signal.severity,
        confidence: CONFIDENCE_DETERMINISTIC_RULE,
        financialContext: {
          label: "Overdue receivable",
          amountCents: signal.amountCents,
          currency: signal.currency,
        },
        evidence: signal.evidence.map((reference) => ({ ...reference })),
        freshness: {
          asOf: invoice.source.lastSyncedAt,
          status: freshnessStatus(sourceFreshnessMinutes),
        },
        explanation: {
          trigger: "Invoice balance remained unpaid past its due date.",
          observedValue: `${signal.daysOverdue} day${signal.daysOverdue === 1 ? "" : "s"} overdue`,
          expectedBaseline: "Paid by due date",
          confidence: "high",
        },
        recommendedActionTypes: ["create_internal_task"],
        detectedAt: now,
      });
    }

    return findings;
  },
};
