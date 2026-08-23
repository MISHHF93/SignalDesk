import { createHash, randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Universal Data Intake (Prompt 28, docs/product-vision-backlog.md, ADR
 * 0038) — routes CSV-imported invoices through the exact same
 * `source_records` → `invoices` provenance chain every real connector
 * uses (ADR 0003/0014), with `source_system = 'csv_import'` as an honest,
 * distinct provenance marker rather than masquerading as a live sync.
 */

const CSV_IMPORT_SOURCE_SYSTEM = "csv_import";
const CSV_IMPORT_EXTERNAL_ACCOUNT_ID = "self";

/**
 * Finds or creates the one synthetic `integrations` row every CSV import
 * for this organization reuses — mirrors `findOrCreateQuickBooksIntegration`'s
 * exact atomic-upsert pattern. Unlike a real connector, there is no OAuth
 * exchange behind this: it exists purely so CSV-imported data can flow
 * through the same real `source_records`/`sync_jobs` foreign keys every
 * other ingest path already requires, never surfaced in the Integration
 * Hub's connector catalog (that catalog is for third-party OAuth
 * connectors specifically).
 */
export async function ensureCsvImportIntegration(
  pool: DatabasePool,
  organizationId: string,
): Promise<{ readonly id: string }> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{ id: string }>(
      `insert into integrations (id, organization_id, source_system, external_account_id, status)
       values ($1, $2, $3, $4, 'active')
       on conflict (organization_id, source_system, external_account_id)
       do update set status = 'active'
       returning id`,
      [
        randomUUID(),
        organizationId,
        CSV_IMPORT_SOURCE_SYSTEM,
        CSV_IMPORT_EXTERNAL_ACCOUNT_ID,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("csv_import integrations upsert returned no row");
    }

    return { id: row.id };
  });
}

export interface IngestCsvInvoiceInput {
  /** The row's own `contentHash` (`@signaldesk/csv-import`) — doubles as
   * both the external record id and the idempotency basis, so
   * re-importing the identical row (same file re-uploaded, or a
   * duplicate row within one file) is a real no-op at the database layer,
   * the same mechanism every connector's `on conflict do nothing` already
   * relies on. */
  readonly contentHash: string;
  readonly customerName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly dueAt: Date;
  readonly status: "open" | "paid" | "void";
  readonly syncJobId: string;
}

export interface IngestCsvInvoiceResult {
  readonly invoiceId: string | null;
  readonly inserted: boolean;
}

export async function ingestCsvInvoice(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  input: IngestCsvInvoiceInput,
): Promise<IngestCsvInvoiceResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordId = randomUUID();
    const idempotencyKey = `csv_import:invoice:${input.contentHash}`;
    const payloadSha256 = createHash("sha256")
      .update(input.contentHash)
      .digest("hex");

    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
         sync_job_id
       ) values ($1, $2, $3, $4, 'invoice', $5, '1', 1, $6, now(), $7, 0, $8)
       on conflict (organization_id, idempotency_key) do nothing
       returning id`,
      [
        sourceRecordId,
        organizationId,
        integrationId,
        CSV_IMPORT_SOURCE_SYSTEM,
        input.contentHash,
        idempotencyKey,
        payloadSha256,
        input.syncJobId,
      ],
    );

    const insertedSourceRecord = sourceRecordResult.rows[0];

    if (!insertedSourceRecord) {
      return { invoiceId: null, inserted: false };
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
         1, 'csv-invoice-v1'
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

    return { invoiceId, inserted: true };
  });
}

export interface CsvImportSummary {
  readonly invoiceCount: number;
  readonly lastImportedAt: Date | null;
}

/**
 * A real, honest summary of this organization's CSV-imported invoices —
 * a count and a real timestamp, not a fabricated `Invoice[]` (that would
 * need every field this query doesn't select, and inventing placeholder
 * values for them is exactly the fabricated-data behavior this app
 * refuses to do elsewhere). `source_records.source_system = 'csv_import'`
 * is what makes this real, queryable provenance — honoring "imported data
 * must never masquerade as live data" (Prompt 28's own words).
 */
export async function getCsvImportSummary(
  pool: DatabasePool,
  organizationId: string,
): Promise<CsvImportSummary> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{
      invoice_count: string;
      last_imported_at: Date | null;
    }>(
      `select count(*) as invoice_count, max(i.created_at) as last_imported_at
       from invoices i
       join source_records sr
         on sr.organization_id = i.organization_id and sr.id = i.source_record_id
       where i.organization_id = $1 and sr.source_system = $2`,
      [organizationId, CSV_IMPORT_SOURCE_SYSTEM],
    );

    const row = result.rows[0];

    return {
      invoiceCount: row ? Number(row.invoice_count) : 0,
      lastImportedAt: row?.last_imported_at ?? null,
    };
  });
}
