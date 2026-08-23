import { createHash, randomUUID } from "node:crypto";

import { endOfDateOnlyDayUtc } from "@signaldesk/domain";

import type { QuickBooksInvoice, QuickBooksPayment } from "./client";

/**
 * Maps a QuickBooks Invoice onto the shape `parseSourceInvoiceRecord`
 * (`@signaldesk/schemas`) expects. Mirrors
 * `mapHubSpotDealToSourceLeadRecord`'s own contract exactly: returns a
 * plain `unknown`-shaped object (runtime validation stays at the real
 * boundary, the caller in apps/web), and is honest about a known
 * simplification rather than silently guessing.
 *
 * Known simplification: `currency` is always `"USD"`. QuickBooks Online
 * invoices carry a `CurrencyRef` only for multi-currency-enabled company
 * files, which this v1 query doesn't fetch — safe for a US-only company
 * file (the common case for this app's target ICP), wrong for a
 * multi-currency one. Same category of gap as HubSpot's
 * contactName/companyName fallback: honestly documented, not hidden.
 *
 * Returns `null` (not a validation error) for an invoice with no due date
 * set — QuickBooks allows this when a company file has no payment terms
 * configured, and "overdue" has no meaning without a due date to compare
 * against.
 */

const DEFAULT_CURRENCY = "USD";

// Shared by both the invoice and payment mappers below — Intuit's own
// `CustomerRef` shape (`{ value, name? }`) is identical on both entities
// (`client.ts`'s own cross-verification note against the production PHP
// SDK). `DisplayName` is nominally required when a Customer is *created*
// (Intuit's Customer docs: DisplayName, or at least one name-part field,
// must be set), but that's a create-time constraint on the Customer
// object, not a guarantee every `CustomerRef.name` this app ever receives
// is populated — this app doesn't control what upstream data looked like
// (a QuickBooks Desktop migration, a customer renamed to blank via a
// partial update, or any other real-world drift), so treats it the same
// as HubSpot's `dealname`/Salesforce's `Name`: a real, already-tested
// fallback (see `mapper.test.ts`), just previously missing the same
// audit-visibility companion function those two connectors already have.
function isCustomerRefNameMissing(
  customerRef: QuickBooksInvoice["CustomerRef"],
): boolean {
  return !customerRef.name?.trim();
}

/**
 * Reports which critical fields this invoice would need a fallback for,
 * without performing the mapping itself — same schema-drift-visibility
 * extension point as `detectHubSpotDealDefaultedFields`
 * (`hubspot/mapper.ts`, issue 5, `docs/25-issue-audit.md`). Deliberately
 * additive; never changes mapping behavior itself.
 */
export function detectQuickBooksInvoiceDefaultedFields(
  invoice: QuickBooksInvoice,
): readonly string[] {
  return isCustomerRefNameMissing(invoice.CustomerRef)
    ? ["CustomerRef.name"]
    : [];
}

export function mapQuickBooksInvoiceToSourceInvoiceRecord(
  invoice: QuickBooksInvoice,
  now: Date,
): unknown | null {
  if (!invoice.DueDate) {
    return null;
  }

  const recordDigestSha256 = createHash("sha256")
    .update(JSON.stringify(invoice))
    .digest("hex");

  return {
    id: randomUUID(),
    customerName: isCustomerRefNameMissing(invoice.CustomerRef)
      ? `QuickBooks customer ${invoice.CustomerRef.value}`
      : invoice.CustomerRef.name!.trim(),
    amountCents: Math.round(invoice.Balance * 100),
    currency: DEFAULT_CURRENCY,
    // DueDate is date-only ("yyyy-MM-dd", no time) — end-of-day UTC, not
    // JS's own UTC-midnight default, so this never registers as overdue
    // before the real local due date has actually elapsed. See
    // `endOfDateOnlyDayUtc`'s own doc comment (@signaldesk/domain).
    dueAt: endOfDateOnlyDayUtc(invoice.DueDate),
    status: "open",
    source: {
      system: "quickbooks",
      externalRecordId: invoice.Id,
      sourceVersion: invoice.SyncToken,
      recordDigestSha256,
      lastSyncedAt: now.toISOString(),
    },
  };
}

/**
 * Maps a QuickBooks Payment onto the shape `parseSourcePaymentRecord`
 * (`@signaldesk/schemas`) expects. Mirrors the invoice mapper above:
 * `currency` is always `"USD"` (same known simplification), returns a
 * plain `unknown`-shaped object with runtime validation at the real
 * boundary in apps/web.
 *
 * `invoiceAllocations` is built from every line's own `Amount`, not the
 * payment's `TotalAmt` — a bulk payment settling several invoices carries
 * one line per invoice, each with its own real applied amount, so this
 * never repeats the payment's full total across every invoice it touched
 * (the real over-attribution bug this shape replaced: see
 * `packages/dependencies/src/resolve.ts`). Only `LinkedTxn` entries where
 * `TxnType === "Invoice"` are kept — QuickBooks payments can also link to
 * other transaction types (e.g. credit memos), which this v1 doesn't track
 * since nothing in this app consumes them yet. A line linking to more than
 * one invoice (structurally possible, never observed in this app's real
 * synced data) has no further per-invoice breakdown available from
 * QuickBooks, so that line's `Amount` is split evenly across its invoices
 * — a documented approximation for a genuinely rare shape, not the
 * previous behavior of repeating the same figure for each.
 */

/**
 * Reports which critical fields this payment would need a fallback for —
 * same extension point as `detectQuickBooksInvoiceDefaultedFields` above.
 */
export function detectQuickBooksPaymentDefaultedFields(
  payment: QuickBooksPayment,
): readonly string[] {
  return isCustomerRefNameMissing(payment.CustomerRef)
    ? ["CustomerRef.name"]
    : [];
}

export function mapQuickBooksPaymentToSourcePaymentRecord(
  payment: QuickBooksPayment,
  now: Date,
): unknown {
  const recordDigestSha256 = createHash("sha256")
    .update(JSON.stringify(payment))
    .digest("hex");

  const invoiceAllocations = (payment.Line ?? []).flatMap((line) => {
    const invoiceLinks = (line.LinkedTxn ?? []).filter(
      (linkedTxn) => linkedTxn.TxnType === "Invoice",
    );

    if (invoiceLinks.length === 0 || line.Amount === undefined) {
      return [];
    }

    const amountCentsPerInvoice = Math.round(
      (line.Amount * 100) / invoiceLinks.length,
    );

    return invoiceLinks.map((linkedTxn) => ({
      externalInvoiceId: linkedTxn.TxnId,
      amountCents: amountCentsPerInvoice,
    }));
  });

  return {
    id: randomUUID(),
    customerName: isCustomerRefNameMissing(payment.CustomerRef)
      ? `QuickBooks customer ${payment.CustomerRef.value}`
      : payment.CustomerRef.name!.trim(),
    amountCents: Math.round(payment.TotalAmt * 100),
    currency: DEFAULT_CURRENCY,
    // TxnDate is also date-only — same end-of-day-UTC treatment as
    // dueAt above, for the same reason (no per-org timezone context
    // reaches this pure mapper).
    receivedAt: endOfDateOnlyDayUtc(payment.TxnDate),
    invoiceAllocations,
    source: {
      system: "quickbooks",
      externalRecordId: payment.Id,
      sourceVersion: payment.SyncToken,
      recordDigestSha256,
      lastSyncedAt: now.toISOString(),
    },
  };
}
