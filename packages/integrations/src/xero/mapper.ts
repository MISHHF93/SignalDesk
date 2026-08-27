import { createHash, randomUUID } from "node:crypto";

import { endOfDateOnlyDayUtc } from "@signaldesk/domain";

import type { XeroInvoice } from "./client";

/**
 * Maps a Xero Invoice onto the shape `parseSourceInvoiceRecord`
 * (`@signaldesk/schemas`) expects. Mirrors
 * `mapQuickBooksInvoiceToSourceInvoiceRecord`'s own contract exactly:
 * returns a plain `unknown`-shaped object (runtime validation stays at
 * the real boundary in apps/web), `currency` is always `"USD"` (same
 * known simplification QuickBooks' own mapper already discloses — a
 * multi-currency Xero organisation isn't handled by this v1), and
 * returns `null` (not a validation error) for an invoice with no due
 * date, the same honest "not every invoice has one" case QuickBooks'
 * mapper already handles.
 *
 * Real Xero-specific quirk, handled only here: `DueDate`/`UpdatedDateUTC`
 * arrive in a legacy .NET wire-format DateTime string
 * (`/Date(1699999999000+0000)/`), not ISO-8601 — `parseXeroDate` extracts
 * the real epoch-milliseconds value directly rather than trying (and
 * failing) to hand the raw string to `new Date(...)`.
 *
 * Real gap found by review: `DueDate` is a date-only field (no
 * time-of-day component — Xero's own wire format always resolves it to
 * plain midnight UTC for the calendar date), the same shape
 * `endOfDateOnlyDayUtc`'s own doc comment (`@signaldesk/domain`) already
 * anchors correctly for QuickBooks/Asana/Jira's equivalent date-only due
 * fields — but this mapper used to hand the raw parsed instant straight
 * to `dueAt` with no buffer, the exact over-eager mistake that helper
 * exists to fix. For any UTC-negative timezone (the US, this app's
 * primary market), that fired `evaluateOverdueInvoice`'s overdue check up
 * to a full calendar day before the invoice's real local due date had
 * even begun. Fixed by re-anchoring through the same helper every other
 * date-only-due-field connector already uses.
 */

const DEFAULT_CURRENCY = "USD";

const XERO_DATE_PATTERN = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/;

// Real gap found by review: this mapper already had the same
// silently-defaulted-name fallback HubSpot's `dealname`/QuickBooks'
// `CustomerRef.name`/Asana's task `name` do (`Xero contact
// ${ContactID}` below), but — unlike those three, and unlike
// Salesforce/Jira/Zendesk's own equivalents — never gained the matching
// audit-visibility companion function (`docs/25-issue-audit.md` issue
// 5's own extension point). A blank `Contact.Name` on a real invoice is
// exactly the same class of upstream data drift those other connectors
// already surface as a counted, logged signal rather than silently
// swallowing it.
function isContactNameMissing(contact: XeroInvoice["Contact"]): boolean {
  return !contact.Name?.trim();
}

/**
 * Reports which critical fields this invoice would need a fallback for,
 * without performing the mapping itself — same schema-drift-visibility
 * extension point as `detectQuickBooksInvoiceDefaultedFields`
 * (`quickbooks/mapper.ts`). Deliberately additive; never changes mapping
 * behavior itself.
 */
export function detectXeroInvoiceDefaultedFields(
  invoice: XeroInvoice,
): readonly string[] {
  return isContactNameMissing(invoice.Contact) ? ["Contact.Name"] : [];
}

/**
 * Parses Xero's legacy .NET wire-format DateTime string. Throws on a
 * genuinely malformed value rather than silently returning an invalid
 * Date — a caller (the mapper below) is expected to have already checked
 * for a present-but-unparseable value being worth skipping, the same way
 * `mapQuickBooksInvoiceToSourceInvoiceRecord` treats a missing `DueDate`.
 */
export function parseXeroDate(value: string): Date {
  const match = XERO_DATE_PATTERN.exec(value);

  if (!match) {
    throw new Error(`Unrecognized Xero DateTime format: ${value}`);
  }

  return new Date(Number(match[1]));
}

export function mapXeroInvoiceToSourceInvoiceRecord(
  invoice: XeroInvoice,
  now: Date,
): unknown | null {
  if (!invoice.DueDate) {
    return null;
  }

  let dueAt: Date;
  let updatedAt: Date;

  try {
    dueAt = parseXeroDate(invoice.DueDate);
    // UpdatedDateUTC is Xero's own real per-revision signal, the same
    // role QuickBooks' SyncToken and HubSpot's hs_lastmodifieddate play
    // — but unlike those, it arrives in the same non-comparable legacy
    // wire format DueDate does, so it's parsed here too rather than
    // stored raw: sync-xero.ts compares this value directly (as an ISO
    // string) to compute the next sync cursor, and re-embeds it verbatim
    // as a real `If-Modified-Since` header on the next incremental run —
    // neither works against the raw `/Date(...)/ ` form.
    updatedAt = parseXeroDate(invoice.UpdatedDateUTC);
  } catch {
    // A genuinely malformed date is the same "can't determine overdue-ness"
    // case as no date at all — skip, don't guess.
    return null;
  }

  const recordDigestSha256 = createHash("sha256")
    .update(JSON.stringify(invoice))
    .digest("hex");

  return {
    id: randomUUID(),
    customerName: isContactNameMissing(invoice.Contact)
      ? `Xero contact ${invoice.Contact.ContactID}`
      : invoice.Contact.Name!.trim(),
    amountCents: Math.round(invoice.AmountDue * 100),
    currency: DEFAULT_CURRENCY,
    dueAt: endOfDateOnlyDayUtc(dueAt.toISOString().slice(0, 10)),
    status: "open",
    source: {
      system: "xero",
      externalRecordId: invoice.InvoiceID,
      sourceVersion: updatedAt.toISOString(),
      recordDigestSha256,
      lastSyncedAt: now.toISOString(),
    },
  };
}
