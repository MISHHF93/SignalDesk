import type { Invoice } from "@signaldesk/domain";
import { groupByCurrency } from "@signaldesk/semantics";

/**
 * A first real, narrow slice of the "Business Digital Twin" proposal
 * (Prompt 14, `docs/product-vision-backlog.md`, ADR 0031) — deterministic
 * arithmetic over the organization's real currently-overdue invoices, not
 * a general scenario/hypothetical-state engine. Pure and synchronous:
 * simulating "what if invoice X gets paid" never mutates any real
 * invoice, matching the proposal's own "simulations must never mutate
 * production business state" rule by construction (there is no write
 * path here at all).
 */

export interface OverdueExposureByCurrency {
  readonly currency: string;
  readonly count: number;
  readonly amountCents: number;
}

export interface InvoicePaymentScenarioResult {
  readonly label: "SIMULATION";
  readonly assumedPaidInvoiceIds: readonly string[];
  readonly baseline: readonly OverdueExposureByCurrency[];
  readonly scenario: readonly OverdueExposureByCurrency[];
}

/**
 * Reuses `@signaldesk/semantics`'s `groupByCurrency` — the same real
 * per-currency grouping `computeOverdueReceivableExposure` runs on this
 * app's canonical AR metric — rather than a second, hand-rolled sum that
 * could silently drift from the canonical definition of "overdue" (issue
 * 7, `docs/25-issue-audit.md`: "Semantic Metric Consistency"). Sorted for
 * a stable, deterministic render order.
 */
function summarizeByCurrency(
  invoices: readonly Invoice[],
): readonly OverdueExposureByCurrency[] {
  const groups = groupByCurrency(
    invoices,
    (invoice) => invoice.currency,
    (invoice) => invoice.amountCents,
  );

  return Array.from(groups.entries())
    .map(([currency, group]) => ({
      currency,
      count: group.records.length,
      amountCents: group.totalCents,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Compares the organization's real overdue-receivables exposure (grouped
 * by currency — invoices are never summed across currencies, since that
 * would silently misrepresent the total) against a hypothetical where the
 * given invoice ids are assumed paid. `overdueInvoices` should be the
 * real, current result of `listOverdueInvoices` — this function trusts
 * its caller for freshness and tenant scoping, the same contract
 * `generateDailyBrief` already has with its own findings input.
 */
export function simulateInvoicePaymentScenario(
  overdueInvoices: readonly Invoice[],
  assumedPaidInvoiceIds: readonly string[],
): InvoicePaymentScenarioResult {
  const assumedPaidSet = new Set(assumedPaidInvoiceIds);
  const remaining = overdueInvoices.filter(
    (invoice) => !assumedPaidSet.has(invoice.id),
  );

  return {
    label: "SIMULATION",
    assumedPaidInvoiceIds,
    baseline: summarizeByCurrency(overdueInvoices),
    scenario: summarizeByCurrency(remaining),
  };
}
