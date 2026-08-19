import { createHash, randomUUID } from "node:crypto";

import type { QuickBooksInvoice } from "./client";

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
    customerName:
      invoice.CustomerRef.name?.trim() ||
      `QuickBooks customer ${invoice.CustomerRef.value}`,
    amountCents: Math.round(invoice.Balance * 100),
    currency: DEFAULT_CURRENCY,
    dueAt: new Date(invoice.DueDate).toISOString(),
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
