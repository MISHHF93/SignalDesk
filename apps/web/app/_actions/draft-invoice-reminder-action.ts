"use server";

import type { InvoiceReminderDraftContext } from "@signaldesk/application";
import { daysOverdue, type Invoice } from "@signaldesk/domain";
import { getInvoiceById } from "@signaldesk/persistence";

import type { DraftInvoiceReminderActionResult } from "../_lib/actions";
import { draftEntityContentAction } from "../_lib/draft-entity-content-action";

/**
 * The drafting half of ADR 0057's QuickBooks invoice-reminder flow — the
 * generalized-orchestrator counterpart to `draft-message-reply-action.ts`,
 * configured for QuickBooks instead of Gmail. Every field the draft needs
 * already comes from this app's own normalized `invoices` row.
 */
const draft = draftEntityContentAction<Invoice, InvoiceReminderDraftContext>({
  findingType: "invoice.overdue",
  entityKind: "invoice",
  newFindingType: "invoice.reminder_drafted",
  actionType: "send_invoice_reminder",
  capability: "draft_invoice_reminder",
  objective: "Draft a payment-reminder email for this overdue invoice.",
  keyPrefix: "invoice-reminder-draft",
  declinedEventType: "invoice_reminder_draft.declined",
  notFoundMessage: "This invoice is no longer overdue.",
  staleEvidenceMessage:
    "The evidence behind this invoice hasn't refreshed recently enough to draft a reminder confidently right now.",
  loadFailedMessage: "Could not load this invoice.",
  draftedMessage: "Reminder drafted.",
  draftFailedMessage: "Couldn't draft a reminder right now.",
  fetchEntity: (db, organizationId, invoiceId) =>
    getInvoiceById(db, organizationId, invoiceId),
  buildDraftContext: (invoice, finding) => {
    // Real gap found by review: `invoices` is a shared table — QuickBooks
    // and Xero both ingest into it (ingestQuickBooksInvoice/
    // ingestXeroInvoice, @signaldesk/persistence), distinguished only by
    // `invoice.source.system`. Only the QuickBooks send path exists today
    // (sendQuickBooksInvoiceReminder, approve-invoice-reminder-action.ts)
    // — nothing here checked that before this fix, so a Xero-sourced
    // overdue invoice could be drafted and would only fail (or worse,
    // silently target the wrong invoice if an id ever collided) once
    // approval tried to actually send it through QuickBooks. Checked at
    // draft time too, not just approval time, so this fails with an
    // honest, specific reason as early as possible, per CLAUDE.md's own
    // rule that coverage logic must key off capability/connector, never
    // assume one vendor for every row in a shared table.
    if (invoice.source.system !== "quickbooks") {
      throw new Error(
        `Invoice reminders can currently only be sent through QuickBooks; this invoice was synced from ${invoice.source.system}.`,
      );
    }

    return {
      capability: "draft_invoice_reminder",
      finding,
      customerName: invoice.customerName,
      amountCents: invoice.amountCents,
      currency: invoice.currency,
      dueAt: invoice.dueAt,
      daysOverdue: daysOverdue(invoice.dueAt, new Date()),
    };
  },
  collaborationEntityRef: (invoiceId) => ({ invoiceId }),
});

export async function draftInvoiceReminderAction(
  invoiceId: string,
): Promise<DraftInvoiceReminderActionResult> {
  return draft(invoiceId);
}
