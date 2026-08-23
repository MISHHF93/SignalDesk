import { randomUUID } from "node:crypto";

import type { Payment, PaymentInvoiceAllocation } from "@signaldesk/domain";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Writes one mapped QuickBooks payment into `source_records` → `payments`.
 * Mirrors `ingestQuickBooksInvoice` exactly — append-only for app_runtime,
 * idempotent on `(organization_id, idempotency_key)`.
 */

export interface IngestSourcePaymentInput {
  readonly externalRecordId: string;
  readonly sourceVersion: string;
  readonly rawPayloadSha256: string;
  readonly rawPayloadByteLength: number;
  readonly observedAt: Date;
  readonly customerName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly receivedAt: Date;
  readonly invoiceAllocations: readonly PaymentInvoiceAllocation[];
  /** See `IngestSourceInvoiceInput.syncJobId`'s doc comment (invoices.ts,
   * ADR 0029) — the same real trace identity, required for every real
   * caller. */
  readonly syncJobId: string;
}

export interface IngestSourcePaymentResult {
  readonly sourceRecordId: string | null;
  readonly paymentId: string | null;
  readonly inserted: boolean;
}

export async function ingestQuickBooksPayment(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  input: IngestSourcePaymentInput,
): Promise<IngestSourcePaymentResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordId = randomUUID();
    const idempotencyKey = `quickbooks:payment:${input.externalRecordId}:${input.sourceVersion}`;

    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
         sync_job_id
       ) values ($1, $2, $3, 'quickbooks', 'payment', $4, $5, 1, $6, $7, $8, $9, $10)
       on conflict (organization_id, idempotency_key) do nothing
       returning id`,
      [
        sourceRecordId,
        organizationId,
        integrationId,
        input.externalRecordId,
        input.sourceVersion,
        idempotencyKey,
        input.observedAt,
        input.rawPayloadSha256,
        input.rawPayloadByteLength,
        input.syncJobId,
      ],
    );

    const insertedSourceRecord = sourceRecordResult.rows[0];

    if (!insertedSourceRecord) {
      // Already ingested at this exact source_version — not an error.
      return { sourceRecordId: null, paymentId: null, inserted: false };
    }

    const paymentId = randomUUID();

    await client.query(
      `insert into payments (
         id, organization_id, source_record_id,
         customer_name, amount_cents, currency, received_at,
         invoice_allocations,
         canonical_schema_version, normalization_version
       ) values (
         $1, $2, $3,
         $4, $5, $6, $7,
         $8::jsonb,
         1, 'quickbooks-payment-v1'
       )`,
      [
        paymentId,
        organizationId,
        insertedSourceRecord.id,
        input.customerName,
        input.amountCents,
        input.currency,
        input.receivedAt,
        JSON.stringify(input.invoiceAllocations),
      ],
    );

    return {
      sourceRecordId: insertedSourceRecord.id,
      paymentId,
      inserted: true,
    };
  });
}

interface PaymentWithSourceRow {
  readonly id: string;
  readonly organization_id: string;
  readonly customer_name: string;
  readonly amount_cents: string;
  readonly currency: string;
  readonly received_at: Date;
  readonly invoice_allocations: unknown;
  readonly integration_id: string;
  readonly source_system: string;
  readonly external_record_id: string;
  readonly source_version: string;
  readonly record_digest_sha256: string;
  readonly last_synced_at: Date;
}

/**
 * `invoice_allocations` is a real jsonb column — genuinely `unknown` at the
 * row boundary, not just typed that way defensively (same discipline as
 * `agent_task_results.claims`/`evidence_ids`, `agent-task-results.ts`). A
 * blind cast here would let a malformed row (a historical row from before
 * this shape existed, a manual DB fix) reach `resolvePaymentInvoiceDependencies`
 * (`@signaldesk/dependencies`) and either crash on an unexpected shape or,
 * worse, silently misreport a dollar amount.
 */
function toInvoiceAllocations(
  value: unknown,
): readonly PaymentInvoiceAllocation[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).externalInvoiceId ===
          "string" &&
        typeof (item as Record<string, unknown>).amountCents === "number",
    )
  ) {
    throw new Error(
      `payments.invoice_allocations is not a valid allocation array: ${JSON.stringify(value)}`,
    );
  }

  return value as readonly PaymentInvoiceAllocation[];
}

function toPayment(row: PaymentWithSourceRow): Payment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    customerName: row.customer_name,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    receivedAt: row.received_at,
    invoiceAllocations: toInvoiceAllocations(row.invoice_allocations),
    source: {
      integrationId: row.integration_id,
      system: row.source_system,
      externalRecordId: row.external_record_id,
      sourceVersion: row.source_version,
      recordDigestSha256: row.record_digest_sha256,
      lastSyncedAt: row.last_synced_at,
    },
  };
}

const MAX_RECENT_PAYMENTS = 10;

/**
 * The most recent payments worth surfacing as "what came in" — capped at
 * `MAX_RECENT_PAYMENTS` and newest-received-first, mirroring
 * `listOverdueInvoices`'s active-or-degraded-integration-only filter and
 * cap discipline for the same reason (a disconnected connector's data
 * stops being surfaced, not just stops syncing; a merely `degraded` one,
 * ADR 0043, keeps surfacing what it already validly ingested).
 */
export async function listRecentPayments(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly Payment[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<PaymentWithSourceRow>(
      `select
         p.id as id,
         p.organization_id as organization_id,
         p.customer_name as customer_name,
         p.amount_cents as amount_cents,
         p.currency as currency,
         p.received_at as received_at,
         p.invoice_allocations as invoice_allocations,
         sr.integration_id as integration_id,
         sr.source_system as source_system,
         sr.external_record_id as external_record_id,
         sr.source_version as source_version,
         sr.raw_payload_sha256 as record_digest_sha256,
         sr.ingested_at as last_synced_at
       from payments p
       join source_records sr
         on sr.organization_id = p.organization_id and sr.id = p.source_record_id
       join integrations ig
         on ig.organization_id = p.organization_id and ig.id = sr.integration_id
       where p.organization_id = $1
         and ig.status in ('active', 'degraded')
       order by p.received_at desc
       limit ${MAX_RECENT_PAYMENTS}`,
      [organizationId],
    );

    return result.rows.map(toPayment);
  });
}
