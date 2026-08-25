import {
  findDependenciesForInvoice,
  resolvePaymentInvoiceDependencies,
} from "@signaldesk/dependencies";
import {
  evaluateOverdueInvoice,
  normalizeEntityName,
} from "@signaldesk/domain";
import type { CardSeverity } from "@signaldesk/schemas";

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
 *
 * Also resolves real Dependency Intelligence (Prompt 23,
 * docs/product-vision-backlog.md, ADR 0036): when a real payment is
 * linked to a still-overdue invoice (a partial payment, or a full payment
 * the closed-invoice sync hasn't caught up to yet — both real, reachable
 * states given how `updateInvoiceStatusBySourceRecord` only runs against
 * QuickBooks' own zero-balance list), the finding says so explicitly
 * instead of reading identically to an invoice with no payment activity
 * at all.
 */
export const overdueInvoiceIntelligence: IntelligenceCapability = {
  id: "overdue-invoice",
  description: "Detects unpaid invoices that have passed their due date.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const { overdueInvoices, recentPayments, now, highValueThresholdCents } =
      context;
    const findings: IntelligenceFinding[] = [];
    const dependencies = resolvePaymentInvoiceDependencies(
      recentPayments,
      overdueInvoices,
    );
    const paymentsById = new Map(
      recentPayments.map((payment) => [payment.id, payment]),
    );

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

      // A `Payment` and its linked `Invoice` are independent domain
      // records, each carrying its own free-standing `currency` field —
      // nothing guarantees they match once a second payment-bearing
      // connector (or a CSV import) exists. Narrowed to same-currency
      // dependencies before summing/narrating, so this can never combine
      // amounts in different currencies into one misleading figure
      // labeled with only the invoice's own currency (found by a deep
      // audit, 2026-08-22 — not reachable with today's single-connector,
      // single-currency data, but a real bug on the wire regardless).
      const linkedDependencies = findDependenciesForInvoice(
        dependencies,
        invoice.id,
      ).filter((dependency) => dependency.currency === invoice.currency);
      const linkedPaymentCents = linkedDependencies.reduce(
        (total, dependency) => total + dependency.amountCents,
        0,
      );
      const linkedPaymentEvidence = linkedDependencies
        .map((dependency) => paymentsById.get(dependency.from.id)?.source)
        .filter((source) => source !== undefined)
        .map((source) => ({ ...source }));

      // Real bug found by review: `financialContext.amountCents` (labeled
      // "OUTSTANDING_AMOUNT") and `severity` used to come from the
      // invoice's raw, unnetted `amountCents` even when a real linked
      // payment was already known — overstating both the true remaining
      // exposure and the urgency for exactly the "full payment, closed-
      // invoice sync hasn't caught up yet" case this file's own doc
      // comment already names as real and reachable. Netting here (not in
      // `evaluateOverdueInvoice`, which only ever sees one Invoice and has
      // no way to know about a linked Payment) keeps the deterministic
      // per-entity rule pure while still reporting a truthful figure.
      const outstandingCents = Math.max(
        0,
        invoice.amountCents - linkedPaymentCents,
      );
      const severity: CardSeverity =
        outstandingCents === 0
          ? "low"
          : outstandingCents >= highValueThresholdCents
            ? "critical"
            : "high";
      const fullyCoveredByLinkedPayments =
        linkedDependencies.length > 0 && outstandingCents === 0;

      findings.push({
        id: `overdue-invoice:${invoice.organizationId}:${invoice.id}`,
        type: "invoice.overdue",
        entity: { kind: "invoice", id: invoice.id },
        correlationName: normalizeEntityName(invoice.customerName),
        title: `${invoice.customerName} invoice overdue`,
        summary:
          linkedDependencies.length === 0
            ? signal.explanation
            : fullyCoveredByLinkedPayments
              ? `${signal.explanation} A payment of ${(linkedPaymentCents / 100).toFixed(2)} ${invoice.currency} has already been received and appears to fully cover the balance — likely a sync lag, not a real outstanding balance.`
              : `${signal.explanation} A payment of ${(linkedPaymentCents / 100).toFixed(2)} ${invoice.currency} has already been received against it but did not close it.`,
        severity,
        confidence: CONFIDENCE_DETERMINISTIC_RULE,
        financialContext: {
          label: "Overdue receivable",
          exposureType: "OUTSTANDING_AMOUNT",
          amountCents: outstandingCents,
          currency: signal.currency,
        },
        evidence: [
          ...signal.evidence.map((reference) => ({ ...reference })),
          ...linkedPaymentEvidence,
        ],
        freshness: {
          asOf: invoice.source.lastSyncedAt,
          status: freshnessStatus(sourceFreshnessMinutes),
        },
        explanation: {
          trigger: "Invoice balance remained unpaid past its due date.",
          observedValue:
            linkedDependencies.length === 0
              ? `${signal.daysOverdue} day${signal.daysOverdue === 1 ? "" : "s"} overdue`
              : fullyCoveredByLinkedPayments
                ? `${signal.daysOverdue} day${signal.daysOverdue === 1 ? "" : "s"} overdue; ${(linkedPaymentCents / 100).toFixed(2)} ${invoice.currency} received, balance likely stale`
                : `${signal.daysOverdue} day${signal.daysOverdue === 1 ? "" : "s"} overdue; ${(linkedPaymentCents / 100).toFixed(2)} ${invoice.currency} received but unresolved`,
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
