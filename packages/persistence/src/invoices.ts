import { randomUUID } from "node:crypto";

import type { Invoice } from "@signaldesk/domain";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Writes one mapped QuickBooks invoice into `source_records` → `invoices`.
 * Mirrors `ingestHubSpotDeal` exactly — both tables are append-only for
 * app_runtime, idempotent on `(organization_id, idempotency_key)`, and this
 * is a one-time initial ingest, not incremental re-sync (see the
 * QuickBooks callback route's doc comment).
 */

export interface IngestSourceInvoiceInput {
  readonly externalRecordId: string;
  readonly sourceVersion: string;
  readonly rawPayloadSha256: string;
  readonly rawPayloadByteLength: number;
  readonly observedAt: Date;
  readonly customerName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly dueAt: Date;
  readonly status: "open" | "paid" | "void";
}

export interface IngestSourceInvoiceResult {
  readonly sourceRecordId: string | null;
  readonly invoiceId: string | null;
  readonly inserted: boolean;
}

export async function ingestQuickBooksInvoice(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  input: IngestSourceInvoiceInput,
): Promise<IngestSourceInvoiceResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordId = randomUUID();
    const idempotencyKey = `quickbooks:invoice:${input.externalRecordId}:${input.sourceVersion}`;

    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length
       ) values ($1, $2, $3, 'quickbooks', 'invoice', $4, $5, 1, $6, $7, $8, $9)
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
      ],
    );

    const insertedSourceRecord = sourceRecordResult.rows[0];

    if (!insertedSourceRecord) {
      // Already ingested at this exact source_version — not an error.
      return { sourceRecordId: null, invoiceId: null, inserted: false };
    }

    const invoiceId = randomUUID();

    await client.query(
      `insert into invoices (
         id, organization_id, source_record_id,
         customer_name, amount_cents, currency, due_at, status,
         canonical_schema_version, normalization_version
       ) values (
         $1, $2, $3,
         $4, $5, $6, $7, $8,
         1, 'quickbooks-invoice-v1'
       )`,
      [
        invoiceId,
        organizationId,
        insertedSourceRecord.id,
        input.customerName,
        input.amountCents,
        input.currency,
        input.dueAt,
        input.status,
      ],
    );

    return {
      sourceRecordId: insertedSourceRecord.id,
      invoiceId,
      inserted: true,
    };
  });
}

interface InvoiceWithSourceRow {
  readonly id: string;
  readonly organization_id: string;
  readonly customer_name: string;
  readonly amount_cents: string;
  readonly currency: string;
  readonly due_at: Date;
  readonly status: "open" | "paid" | "void";
  readonly integration_id: string;
  readonly source_system: string;
  readonly external_record_id: string;
  readonly source_version: string;
  readonly record_digest_sha256: string;
  readonly last_synced_at: Date;
}

function toInvoice(row: InvoiceWithSourceRow): Invoice {
  return {
    id: row.id,
    organizationId: row.organization_id,
    customerName: row.customer_name,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    dueAt: row.due_at,
    status: row.status,
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

const MAX_OVERDUE_INVOICES = 10;

/**
 * Every currently-overdue, unpaid invoice worth surfacing — unlike
 * `getPriorityLead`'s single representative record, invoices are
 * independent risk items and each one should get its own finding (see
 * `overdue-invoice.ts`), so this returns the real set rather than picking
 * one. Capped at `MAX_OVERDUE_INVOICES` and ordered oldest-due-first so an
 * organization with many overdue invoices sees its worst exposure first
 * rather than an arbitrary slice — matching the "don't overwhelm the
 * one-page" principle the HubSpot sync's own `MAX_DEAL_PAGES` cap follows.
 *
 * Only considers invoices whose source integration is still `active`,
 * mirroring `getPriorityLead`'s same filter and for the same reason:
 * disconnecting a connector must mean "stop using my data," not just "stop
 * the token from working."
 */
export async function listOverdueInvoices(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly Invoice[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<InvoiceWithSourceRow>(
      `select
         i.id as id,
         i.organization_id as organization_id,
         i.customer_name as customer_name,
         i.amount_cents as amount_cents,
         i.currency as currency,
         i.due_at as due_at,
         i.status as status,
         sr.integration_id as integration_id,
         sr.source_system as source_system,
         sr.external_record_id as external_record_id,
         sr.source_version as source_version,
         sr.raw_payload_sha256 as record_digest_sha256,
         sr.ingested_at as last_synced_at
       from invoices i
       join source_records sr
         on sr.organization_id = i.organization_id and sr.id = i.source_record_id
       join integrations ig
         on ig.organization_id = i.organization_id and ig.id = sr.integration_id
       where i.organization_id = $1
         and i.status = 'open'
         and i.due_at < now()
         and ig.status = 'active'
       order by i.due_at asc
       limit ${MAX_OVERDUE_INVOICES}`,
      [organizationId],
    );

    return result.rows.map(toInvoice);
  });
}
