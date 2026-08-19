import { NextResponse } from "next/server";

import {
  exchangeQuickBooksAuthorizationCode,
  fetchQuickBooksInvoices,
  mapQuickBooksInvoiceToSourceInvoiceRecord,
  type QuickBooksInvoice,
} from "@business-dashboard/integrations/quickbooks";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateQuickBooksIntegration,
  ingestQuickBooksInvoice,
  recordAuditEvent,
  storeQuickBooksTokens,
} from "@business-dashboard/persistence";
import { parseSourceInvoiceRecord } from "@business-dashboard/schemas";

import { consumeOAuthState } from "../../../_lib/oauth-state";
import { getQuickBooksOAuthConfig } from "../../../_lib/quickbooks-config";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

// Bounds the synchronous-in-request initial sync, mirroring HubSpot's own
// MAX_DEAL_PAGES stopgap and for the same reason: one very large
// QuickBooks company file can't hang the OAuth callback indefinitely.
const MAX_INVOICE_PAGES = 20;

/**
 * Completes the QuickBooks Online OAuth flow and runs a one-time initial
 * sync of open, overdue invoices — the second real connector sync in this
 * app, mirroring HubSpot's own (ADR 0008) structure exactly: stores
 * tokens in Vault, then fetches and ingests every open invoice up to
 * `MAX_INVOICE_PAGES` pages. `realmId` is read directly off this
 * callback's own query string — per Intuit's OAuth flow it never appears
 * in the token response body (see client.ts's doc comment). Incremental/
 * recurring sync is explicitly future work, same as HubSpot's.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(
      `${origin}/integrations/quickbooks?quickbooks=${status}`,
    );

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code || !realmId) {
    return redirectTo("error");
  }

  const rateLimit = checkRateLimit(
    `quickbooks-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(
      `${origin}/login?next=/integrations/quickbooks`,
    );
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("quickbooks", state);

  if (!stateIsValid) {
    return redirectTo("error");
  }

  // Real entitlement enforcement: bills by active connections, so a new
  // one is rejected before it's created if the org is already at its
  // plan's limit — checked before the token exchange so a rejected
  // connection doesn't burn the single-use authorization code.
  if (!(await canAddActiveConnection(getPool(), session.organizationId))) {
    return redirectTo("limit");
  }

  try {
    const config = getQuickBooksOAuthConfig(origin);
    const tokens = await exchangeQuickBooksAuthorizationCode(config, code);

    const integration = await findOrCreateQuickBooksIntegration(
      getPool(),
      session.organizationId,
      realmId,
    );

    await storeQuickBooksTokens(
      getPool(),
      session.organizationId,
      integration.id,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "integration.connected",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: { sourceSystem: "quickbooks", realmId },
    });

    const now = new Date();
    let ingested = 0;
    let skipped = 0;

    for (let page = 0; page < MAX_INVOICE_PAGES; page += 1) {
      const invoicePage = await fetchQuickBooksInvoices(
        tokens.accessToken,
        realmId,
        page * 100,
      );

      for (const rawInvoice of invoicePage.results as readonly QuickBooksInvoice[]) {
        const mapped = mapQuickBooksInvoiceToSourceInvoiceRecord(
          rawInvoice,
          now,
        );

        if (mapped === null) {
          // No due date set on the source invoice — "overdue" doesn't
          // apply, not a validation failure (see the mapper's doc
          // comment). Not counted as skipped: nothing was wrong with it.
          continue;
        }

        // Real runtime validation of external data at the boundary
        // (`sourceInvoiceRecordSchema`'s own contract), mirroring the
        // HubSpot loop's own reasoning exactly: one malformed invoice is
        // skipped rather than aborting the whole sync for every other
        // invoice in this company file.
        let invoiceRecord: ReturnType<typeof parseSourceInvoiceRecord>;

        try {
          invoiceRecord = parseSourceInvoiceRecord(mapped, {
            organizationId: session.organizationId,
            integrationId: integration.id,
          });
        } catch (validationError) {
          console.error(
            `Skipping QuickBooks invoice ${rawInvoice.Id}: failed validation`,
            validationError,
          );
          skipped += 1;
          continue;
        }

        const result = await ingestQuickBooksInvoice(
          getPool(),
          session.organizationId,
          integration.id,
          {
            externalRecordId: invoiceRecord.source.externalRecordId,
            sourceVersion: invoiceRecord.source.sourceVersion,
            rawPayloadSha256: invoiceRecord.source.recordDigestSha256,
            rawPayloadByteLength: JSON.stringify(rawInvoice).length,
            observedAt: now,
            customerName: invoiceRecord.customerName,
            amountCents: invoiceRecord.amountCents,
            currency: invoiceRecord.currency,
            dueAt: invoiceRecord.dueAt,
            status: invoiceRecord.status,
          },
        );

        if (result.inserted) {
          ingested += 1;
        }
      }

      if (!invoicePage.hasMore) {
        break;
      }
    }

    if (skipped > 0) {
      console.error(
        `QuickBooks initial sync for integration ${integration.id}: skipped ${skipped} invoice(s) that failed validation.`,
      );
    }

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.completed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: { sourceSystem: "quickbooks", invoicesIngested: ingested },
    });

    return NextResponse.redirect(
      `${origin}/integrations/quickbooks?quickbooks=connected&synced=${ingested}`,
    );
  } catch (error) {
    console.error("QuickBooks OAuth callback failed", error);
    return redirectTo("error");
  }
}
