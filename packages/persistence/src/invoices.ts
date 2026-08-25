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
  /** The `sync_jobs` row this ingestion ran under — a real trace identity
   * from provider event through normalization (Prompt 12,
   * docs/product-vision-backlog.md, ADR 0029). Every real caller has one;
   * required here even though the column stays nullable for historical
   * rows ingested before it existed. */
  readonly syncJobId: string;
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
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
         sync_job_id
       ) values ($1, $2, $3, 'quickbooks', 'invoice', $4, $5, 1, $6, $7, $8, $9, $10)
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

/**
 * Writes one mapped Xero invoice into `source_records` → `invoices`.
 * Mirrors `ingestQuickBooksInvoice` exactly — same table, same append-
 * only/idempotent-on-`sourceVersion` semantics, only the `source_system`/
 * `source_object_type`/`normalization_version` literals differ.
 */
export async function ingestXeroInvoice(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  input: IngestSourceInvoiceInput,
): Promise<IngestSourceInvoiceResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordId = randomUUID();
    const idempotencyKey = `xero:invoice:${input.externalRecordId}:${input.sourceVersion}`;

    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
         sync_job_id
       ) values ($1, $2, $3, 'xero', 'invoice', $4, $5, 1, $6, $7, $8, $9, $10)
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
         1, 'xero-invoice-v1'
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

/**
 * Marks a `sourceSystem`-observed invoice `paid` or `void` when a later
 * sync observes it's no longer open (e.g. QuickBooks' `Balance` reached
 * zero). Uses the new `invoices_tenant_update` policy — this table
 * previously had no UPDATE policy, only select/insert, so this write
 * would have silently affected zero rows under forced RLS before that.
 * Matched by `(organizationId, sourceSystem, externalRecordId)`, not
 * `invoiceId`, since a sync loop only has the source system's own id for
 * the record it just observed, not this app's internal invoice id. Ingest
 * is append-only (a re-synced record with a new `sourceVersion` inserts a
 * new `source_records` row rather than mutating the old one), so more than
 * one row can legitimately match here — `order by observed_at desc limit
 * 1` picks the most recently observed one deterministically instead of
 * letting the subquery return >1 row and fail the whole update.
 *
 * `and status != 'void'` guards the one currently-reachable bad transition:
 * both real callers (`sync-quickbooks.ts`, `sync-xero.ts`) only ever pass
 * `"paid"`, sourced from a "closed/paid invoices" query — if a voided
 * invoice's external id were ever re-observed there (a stale provider
 * cache, an out-of-order sync), this stops it from silently resurrecting a
 * `void` invoice as `paid`. `void` is a terminal state in normal
 * accounting semantics; nothing un-voids an invoice.
 */
export async function updateInvoiceStatusBySourceRecord(
  pool: DatabasePool,
  organizationId: string,
  sourceSystem: string,
  externalRecordId: string,
  status: "open" | "paid" | "void",
): Promise<boolean> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query(
      `update invoices set status = $1
       where organization_id = $2
         and status != 'void'
         and source_record_id = (
           select id from source_records
           where organization_id = $2
             and source_system = $3
             and external_record_id = $4
           order by observed_at desc
           limit 1
         )`,
      [status, organizationId, sourceSystem, externalRecordId],
    );

    return (result.rowCount ?? 0) > 0;
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
 * Every currently-overdue, unpaid invoice worth surfacing — invoices are
 * independent risk items and each one should get its own finding (see
 * `overdue-invoice.ts`), so this returns the real set rather than picking
 * one. Capped at `MAX_OVERDUE_INVOICES` and ordered oldest-due-first so an
 * organization with many overdue invoices sees its worst exposure first
 * rather than an arbitrary slice — matching the "don't overwhelm the
 * one-page" principle the HubSpot sync's own `MAX_DEAL_PAGES` cap follows.
 *
 * Deduplicates to the single most-recently-observed `source_records` row
 * per `(source_system, external_record_id)` before applying the open/
 * overdue filter — ingest is append-only (`ingestQuickBooksInvoice`'s own
 * doc comment): a re-sync that sees a new `source_version` on a still-open
 * invoice (e.g. a partial payment that doesn't zero the balance) inserts a
 * brand-new `invoices` row rather than updating the old one in place.
 * Without this, the stale older row — never touched by
 * `updateInvoiceStatusBySourceRecord` (which only ever updates the row tied
 * to the *latest* source record) — kept matching `status = 'open' and
 * due_at < now()` forever, producing a second live card on the one-page
 * dashboard for the exact same real-world invoice. Same root cause also
 * meant a fully-paid invoice's now-stale older row(s) never stopped
 * appearing as overdue even after the latest row was correctly marked
 * `paid` — this fix closes both symptoms at once, since only the latest
 * row's own `status`/`due_at` is ever considered.
 *
 * Only considers invoices whose source integration is `active` or
 * `degraded`, mirroring `listLeadsForAttention`'s same filter and for the
 * same reason: disconnecting a connector must mean "stop using my data," not
 * just "stop the token from working." A `degraded` connector (ADR 0043 —
 * a recent sync couldn't parse some records) still has real, validly
 * ingested data behind it; only `disconnected`/`revoked` should ever
 * exclude an integration's data here.
 */
export async function listOverdueInvoices(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly Invoice[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<InvoiceWithSourceRow>(
      `select * from (
         select distinct on (sr.source_system, sr.external_record_id)
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
           and ig.status in ('active', 'degraded')
         order by sr.source_system, sr.external_record_id, sr.observed_at desc
       ) latest_invoices
       where status = 'open'
         and due_at < now()
       order by due_at asc
       limit ${MAX_OVERDUE_INVOICES}`,
      [organizationId],
    );

    return result.rows.map(toInvoice);
  });
}

/**
 * One real invoice by id, for a single-entity "draft content about one
 * specific entity" write action (e.g. a QuickBooks invoice reminder) —
 * reuses `listOverdueInvoices`'s core `invoices` ⋈ `source_records` join
 * and its `toInvoice` row mapper, but unlike `listOverdueInvoices` applies
 * none of its filtering conditions (`status = 'open'`, `due_at < now()`,
 * active/degraded integration only) or its dedup-to-latest-source-record
 * subquery — a direct single-entity-by-id lookup should honestly return
 * the invoice's current real state regardless of whether it's still "at
 * risk," matching `getSupportTicketById`'s same behavior
 * (`support-tickets.ts`). Returns `null` for an invoice that doesn't
 * exist or doesn't belong to the caller's own tenant (RLS reduces the
 * query to zero rows rather than raising, so this is a real, honest "not
 * found," not a leaked existence check).
 */
export async function getInvoiceById(
  pool: DatabasePool,
  organizationId: string,
  invoiceId: string,
): Promise<Invoice | null> {
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
       where i.organization_id = $1
         and i.id = $2`,
      [organizationId, invoiceId],
    );

    const row = result.rows[0];

    return row ? toInvoice(row) : null;
  });
}

const MAX_EXPORTED_INVOICES = 1000;

/**
 * Every invoice for a real data-export request -- unlike
 * `listOverdueInvoices`, not filtered to open/overdue or active-integration
 * only. Capped at `MAX_EXPORTED_INVOICES`, newest first.
 */
export async function listAllInvoices(
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
       where i.organization_id = $1
       order by i.due_at desc
       limit ${MAX_EXPORTED_INVOICES}`,
      [organizationId],
    );

    return result.rows.map(toInvoice);
  });
}
