"use server";

import { simulateInvoicePaymentScenario } from "@signaldesk/application";
import type { InvoicePaymentScenarioResult } from "@signaldesk/application";
import {
  createDatabasePool,
  listOverdueInvoices,
  type DatabasePool,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export type SimulateInvoicePaymentActionResult =
  | { readonly ok: true; readonly result: InvoicePaymentScenarioResult }
  | { readonly ok: false; readonly error: string };

/**
 * "What if this invoice gets paid?" — the first real slice of the
 * Business Digital Twin proposal (Prompt 14,
 * docs/product-vision-backlog.md, ADR 0031). Re-fetches the organization's
 * real current overdue invoices (never trusting client-held state, same
 * rule `generateDailyBriefAction` follows) and computes a pure,
 * read-only comparison — no write path exists here, so "never mutate
 * production state" holds by construction, not by convention.
 */
export async function simulateInvoicePaymentAction(
  invoiceId: string,
): Promise<SimulateInvoicePaymentActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const overdueInvoices = await listOverdueInvoices(
      getPool(),
      session.organizationId,
    );

    if (!overdueInvoices.some((invoice) => invoice.id === invoiceId)) {
      return {
        ok: false,
        error: "This invoice is no longer overdue, or no longer exists.",
      };
    }

    const result = simulateInvoicePaymentScenario(overdueInvoices, [invoiceId]);

    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to run this simulation."),
    };
  }
}
