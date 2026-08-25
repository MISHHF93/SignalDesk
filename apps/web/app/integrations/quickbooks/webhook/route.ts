import { NextResponse } from "next/server";

import {
  checkRateLimit,
  createDatabasePool,
  findOrganizationAndIntegrationIdByQuickBooksRealmId,
  recordAuditEvent,
  type DatabasePool,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { logger } from "../../../_lib/logger";
import {
  getQuickBooksWebhookVerifierToken,
  isQuickBooksWebhookConfigured,
} from "../../../_lib/quickbooks-config";
import { verifyQuickBooksWebhookSignature } from "../../../_lib/quickbooks-webhook-signature";
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

interface RawQuickBooksWebhookPayload {
  readonly eventNotifications?: readonly { readonly realmId?: string }[];
}

// Intuit's `intuit-signature` scheme (`quickbooks-webhook-signature.ts`) is
// a plain HMAC over the raw body with no timestamp mixed in, unlike
// Stripe's `stripe-signature` header — Stripe's SDK already rejects a
// signed payload once it's more than 5 minutes old
// (`constructStripeWebhookEvent` → `stripe.webhooks.constructEvent`'s own
// default `DEFAULT_TOLERANCE`), so a captured Stripe signature stops
// verifying on its own. A QuickBooks signature never expires that way, so
// a captured-and-replayed request stays validly signed indefinitely.
// Downstream ingestion is already idempotent (`ingestQuickBooksInvoice`/
// `ingestQuickBooksPayment`'s `ON CONFLICT ... DO NOTHING` on
// `idempotency_key`), so a replay can't corrupt or duplicate data — but it
// can still force real, OAuth-authenticated QuickBooks API calls against a
// connected realm on demand. A hard one-time-only block per exact
// signature was deliberately not used: because the signature has no
// timestamp, Intuit's own legitimate retry of a failed delivery produces
// the *identical* signature, and a one-shot block would silently drop
// that real retry along with an attacker's replay — indistinguishable
// from each other by signature alone. A realm-scoped rate limit bounds
// the abuse blast radius without that failure mode, the same pattern
// already used for every other public endpoint in this app (see
// `checkRateLimit`'s call sites, e.g. the QuickBooks OAuth callback).
const WEBHOOK_RATE_LIMIT_PER_REALM = 60;
const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Real QuickBooks webhook receiver — the first recurring/background sync
 * trigger any connector in this app has (ADR 0022). Intuit configures
 * webhooks once per app in its own developer dashboard, not per
 * connection, so this endpoint has no per-tenant setup step; the
 * notification payload carries only entity ids + realmId, never business
 * data, so the real work is: verify the signature, resolve which
 * organization/integration owns the realm, and run the same sync
 * functions "Sync Now" and the OAuth callback already use — never parse
 * business fields out of the notification itself. No session or
 * `getCurrentOrganization()` call anywhere in this file: this is an
 * unauthenticated, signature-verified server-to-server endpoint, the same
 * shape as `billing/webhooks/stripe/route.ts`.
 *
 * Always returns 200 quickly once the signature is verified — QuickBooks
 * retries on a non-2xx response, matching Stripe's behavior. An
 * unresolvable, rate-limited, or failing realm is logged and skipped, not
 * allowed to fail the whole batch (one bad realm in a multi-company
 * payload shouldn't block every other realm's real sync). See the
 * `WEBHOOK_RATE_LIMIT_PER_REALM` comment below for why this is a
 * realm-scoped rate limit rather than a per-signature replay block.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isQuickBooksWebhookConfigured()) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("intuit-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  if (
    !verifyQuickBooksWebhookSignature(
      rawBody,
      signature,
      getQuickBooksWebhookVerifierToken(),
    )
  ) {
    logger.log("error", "QuickBooks webhook signature verification failed", {
      operation: "quickbooks_webhook.verify_signature",
      connectorSlug: "quickbooks",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: RawQuickBooksWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as RawQuickBooksWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const realmIds = Array.from(
    new Set(
      (payload.eventNotifications ?? [])
        .map((notification) => notification.realmId)
        .filter((realmId): realmId is string => Boolean(realmId)),
    ),
  );

  const db = getPool();

  for (const realmId of realmIds) {
    try {
      const lookup = await findOrganizationAndIntegrationIdByQuickBooksRealmId(
        db,
        realmId,
      );

      if (!lookup) {
        logger.log("warn", "No active integration found for realm", {
          operation: "quickbooks_webhook.resolve_realm",
          connectorSlug: "quickbooks",
          correlationId: realmId,
        });
        continue;
      }

      const rateLimit = await checkRateLimit(
        db,
        `quickbooks-webhook:${realmId}`,
        WEBHOOK_RATE_LIMIT_PER_REALM,
        WEBHOOK_RATE_LIMIT_WINDOW_MS,
      );

      if (!rateLimit.allowed) {
        logger.log("warn", "Rate limit exceeded for realm", {
          operation: "quickbooks_webhook.rate_limit",
          connectorSlug: "quickbooks",
          organizationId: lookup.organizationId,
          correlationId: realmId,
        });
        continue;
      }

      const accessToken = await ensureFreshQuickBooksAccessToken(
        db,
        lookup.organizationId,
        lookup.integrationId,
      );

      const [invoiceResult, paymentResult] = await Promise.all([
        syncQuickBooksInvoices(
          db,
          lookup.organizationId,
          lookup.integrationId,
          accessToken,
          realmId,
          "webhook",
        ),
        syncQuickBooksPayments(
          db,
          lookup.organizationId,
          lookup.integrationId,
          accessToken,
          realmId,
          "webhook",
        ),
      ]);

      await recordAuditEvent(db, lookup.organizationId, {
        actorKind: "integration",
        eventType: "sync.completed",
        subjectType: "integration",
        subjectId: lookup.integrationId,
        outcome: "succeeded",
        metadata: {
          sourceSystem: "quickbooks",
          trigger: "webhook",
          invoicesIngested: invoiceResult.ingested,
          invoicesClosed: invoiceResult.closed,
          paymentsIngested: paymentResult.ingested,
        },
      });
    } catch (error) {
      errorReporter.captureException(error, {
        operation: "quickbooks_webhook.sync",
        connectorSlug: "quickbooks",
        correlationId: realmId,
      });
    }
  }

  return NextResponse.json({ received: true });
}
