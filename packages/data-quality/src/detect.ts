import {
  normalizeEntityName,
  type Invoice,
  type Lead,
} from "@signaldesk/domain";

import type { DataQualityIssue } from "./types";

/**
 * Detects the one real duplicate-entity signal this app's currently-synced
 * data can support: an invoice's `customerName` and a lead's
 * `companyName` that match exactly once trimmed/lowercased, but come from
 * *different* source systems — e.g. a QuickBooks customer and a HubSpot
 * company that are, in reality, the same business, with no relationship
 * modeled between them anywhere in the Business Graph today.
 *
 * Deliberately exact-string only, same discipline
 * `resolvePaymentInvoiceDependencies` (`@signaldesk/dependencies`)
 * follows: no fuzzy/phonetic/probabilistic matching, so every issue this
 * produces is a genuine candidate, never a guess dressed up as one. A
 * same-system pair is never flagged — that's just one real customer
 * already correctly deduplicated by that source system's own id, not two
 * unrelated records.
 */
export function detectInvoiceLeadNameDuplicates(
  invoices: readonly Invoice[],
  leads: readonly Lead[],
  now: Date,
): readonly DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  for (const invoice of invoices) {
    const normalizedCustomerName = normalizeEntityName(invoice.customerName);

    if (!normalizedCustomerName) {
      continue;
    }

    for (const lead of leads) {
      if (lead.source.system === invoice.source.system) {
        continue;
      }

      if (normalizeEntityName(lead.companyName) !== normalizedCustomerName) {
        continue;
      }

      issues.push({
        id: `duplicate_entity:invoice:${invoice.id}:lead:${lead.id}`,
        type: "POTENTIAL_DUPLICATE_ENTITY",
        matchedOn: invoice.customerName,
        entities: [
          { kind: "invoice", id: invoice.id, system: invoice.source.system },
          { kind: "lead", id: lead.id, system: lead.source.system },
        ],
        detectedAt: now,
      });
    }
  }

  return issues;
}
