import type { Invoice, Payment } from "@signaldesk/domain";

import type { Dependency } from "./types";

/**
 * Resolves every `Payment.invoiceAllocations` entry (a raw external
 * invoice id from the source system paired with the real amount applied
 * to it, `@signaldesk/domain`'s own doc comment on that field) into a real
 * internal `Invoice.id` — the one genuine relationship this app's
 * already-synced data implies (Prompt 23, docs/product-vision-backlog.md,
 * ADR 0036). Matches only within the same `source.system` (a QuickBooks
 * payment can only settle a QuickBooks invoice) and only on an exact
 * external-id match — never a fuzzy or name-based guess, so every
 * dependency this produces is genuinely `CONFIRMED_DEPENDENCY`, not an
 * inference.
 *
 * Each dependency's `amountCents` is that invoice's own allocated share,
 * never the payment's full total — a single bulk payment settling several
 * invoices used to make every one of them independently claim the
 * payment's *full* amount as received, a real double (or N-times) count in
 * aggregate. Allocations for the same invoice are summed first (a payment
 * can carry more than one line against the same invoice), so each invoice
 * gets exactly one dependency per payment. A payment can settle more than
 * one invoice, and an invoice can have more than one payment applied
 * against it (installments) — this returns every real match, not just the
 * first.
 */
export function resolvePaymentInvoiceDependencies(
  payments: readonly Payment[],
  invoices: readonly Invoice[],
): readonly Dependency[] {
  const dependencies: Dependency[] = [];

  for (const payment of payments) {
    if (payment.invoiceAllocations.length === 0) {
      continue;
    }

    const amountCentsByExternalInvoiceId = new Map<string, number>();

    for (const allocation of payment.invoiceAllocations) {
      amountCentsByExternalInvoiceId.set(
        allocation.externalInvoiceId,
        (amountCentsByExternalInvoiceId.get(allocation.externalInvoiceId) ??
          0) + allocation.amountCents,
      );
    }

    for (const invoice of invoices) {
      if (invoice.source.system !== payment.source.system) {
        continue;
      }

      const amountCents = amountCentsByExternalInvoiceId.get(
        invoice.source.externalRecordId,
      );

      if (amountCents === undefined) {
        continue;
      }

      dependencies.push({
        id: `payment_settles_invoice:${payment.id}:${invoice.id}`,
        type: "payment_settles_invoice",
        confidence: "CONFIRMED_DEPENDENCY",
        from: { kind: "payment", id: payment.id },
        to: { kind: "invoice", id: invoice.id },
        amountCents,
        currency: payment.currency,
        observedAt: payment.receivedAt,
      });
    }
  }

  return dependencies;
}

/** Every real dependency pointing at a specific invoice — the input an
 * "impact path" / "why is this still open" enrichment reads from. */
export function findDependenciesForInvoice(
  dependencies: readonly Dependency[],
  invoiceId: string,
): readonly Dependency[] {
  return dependencies.filter(
    (dependency) =>
      dependency.to.kind === "invoice" && dependency.to.id === invoiceId,
  );
}
