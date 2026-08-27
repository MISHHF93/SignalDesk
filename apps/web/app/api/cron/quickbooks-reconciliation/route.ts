import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  createDatabasePool,
  listQuickBooksIntegrationsNeedingReconciliation,
  recordAuditEvent,
  type DatabasePool,
} from "@signaldesk/persistence";

import { verifyCronSecret } from "../../../_lib/cron-auth";
import { errorReporter } from "../../../_lib/error-reporter";
import { logger } from "../../../_lib/logger";
import { isQuickBooksConfigured } from "../../../_lib/quickbooks-config";
import {
  ensureFreshQuickBooksAccessToken,
  syncQuickBooksInvoices,
  syncQuickBooksPayments,
} from "../../../_lib/sync-quickbooks";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

// Same real, disclosed safety bound every other cron in this app uses
// (`morning-brief`, `billing-reconciliation`) — bounds one invocation
// within Vercel's function duration limit.
const MAX_INTEGRATIONS_PER_RUN = 500;

/**
 * ISSUES-REMAINING.md P1 #1: the QuickBooks webhook
 * (`integrations/quickbooks/webhook/route.ts`) always acks 200 once its
 * signature verifies, by deliberate design — one bad realm's inline sync
 * failure must never fail the whole multi-company batch. That design
 * choice means Intuit never retries the specific notification that
 * failed, and until now nothing ever went back to catch it up; the
 * incremental sync's own cursor would only advance again on the next
 * successful webhook or a manual "Sync Now" for that org. Bounded
 * impact, not silent-forever: data goes stale, not wrong.
 *
 * This is that catch-up, on a real Vercel Cron schedule
 * (`apps/web/vercel.json`), secured the same `CRON_SECRET` bearer-token
 * way every other cron here is. It reuses the identical
 * `syncQuickBooksInvoices`/`syncQuickBooksPayments` functions the webhook
 * and "Sync Now" already call — deliberately not a new sync mechanism —
 * so any realm whose last webhook silently failed simply gets a fresh,
 * ordinary incremental sync attempt on the next scheduled pass. One
 * integration's failure (a real QuickBooks API error, an unrefreshable
 * token) is caught and reported individually, exactly like
 * `billing-reconciliation`'s own per-subscription isolation, never
 * aborting the rest of the run.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (
    !verifyCronSecret(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isQuickBooksConfigured()) {
    return NextResponse.json(
      { ok: false, error: "QuickBooks is not configured" },
      { status: 503 },
    );
  }

  const db = getPool();
  const integrations = await listQuickBooksIntegrationsNeedingReconciliation(
    db,
    MAX_INTEGRATIONS_PER_RUN,
  );

  let succeeded = 0;
  let failed = 0;
  const results: Array<{
    organizationId: string;
    invoicesIngested: number;
    paymentsIngested: number;
  }> = [];

  for (const integration of integrations) {
    try {
      const accessToken = await ensureFreshQuickBooksAccessToken(
        db,
        integration.organizationId,
        integration.integrationId,
      );

      const [invoiceResult, paymentResult] = await Promise.all([
        syncQuickBooksInvoices(
          db,
          integration.organizationId,
          integration.integrationId,
          accessToken,
          integration.realmId,
          "scheduled_reconciliation",
        ),
        syncQuickBooksPayments(
          db,
          integration.organizationId,
          integration.integrationId,
          accessToken,
          integration.realmId,
          "scheduled_reconciliation",
        ),
      ]);

      await recordAuditEvent(db, integration.organizationId, {
        actorKind: "integration",
        eventType: "sync.completed",
        subjectType: "integration",
        subjectId: integration.integrationId,
        outcome: "succeeded",
        metadata: {
          sourceSystem: "quickbooks",
          trigger: "scheduled_reconciliation",
          invoicesIngested: invoiceResult.ingested,
          invoicesClosed: invoiceResult.closed,
          paymentsIngested: paymentResult.ingested,
        },
      });

      succeeded += 1;
      results.push({
        organizationId: integration.organizationId,
        invoicesIngested: invoiceResult.ingested,
        paymentsIngested: paymentResult.ingested,
      });

      logger.log("info", "Reconciled QuickBooks integration on schedule", {
        operation: "cron.quickbooks_reconciliation",
        organizationId: integration.organizationId,
        connectorSlug: "quickbooks",
      });
    } catch (error) {
      failed += 1;
      errorReporter.captureException(error, {
        organizationId: integration.organizationId,
        connectorSlug: "quickbooks",
        operation: "cron.quickbooks_reconciliation",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    integrationsConsidered: integrations.length,
    succeeded,
    failed,
    results,
  });
}
