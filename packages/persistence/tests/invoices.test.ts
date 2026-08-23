import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  ingestQuickBooksInvoice,
  ingestXeroInvoice,
  listOverdueInvoices,
  updateInvoiceStatusBySourceRecord,
} from "../src/invoices";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedOrganization,
  seedSyncJob,
} from "./support";

function fixtureInput(
  syncJobId: string,
  overrides: Partial<Parameters<typeof ingestQuickBooksInvoice>[3]> = {},
) {
  return {
    externalRecordId: `invoice-${randomUUID()}`,
    sourceVersion: "3",
    rawPayloadSha256: "a".repeat(64),
    rawPayloadByteLength: 512,
    observedAt: new Date(),
    customerName: "Acme Robotics",
    amountCents: 250_000,
    currency: "USD",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
    status: "open" as const,
    syncJobId,
    ...overrides,
  };
}

// Exercises ingestQuickBooksInvoice against the live database: a real
// source_records → invoices write, idempotency on repeat ingestion of the
// same source_version, and tenant isolation.
describe.skipIf(!process.env.DATABASE_URL)(
  "quickbooks invoice sync (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("writes a real source_record and a matching invoice", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
      );
      const input = fixtureInput(job.id);

      const result = await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        input,
      );

      expect(result.inserted).toBe(true);
      expect(result.sourceRecordId).not.toBeNull();
      expect(result.invoiceId).not.toBeNull();

      const [sourceRecordRow, invoiceRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const sourceRecordResult = await client.query(
            "select source_system, source_object_type, external_record_id, sync_job_id from source_records where id = $1",
            [result.sourceRecordId],
          );
          const invoiceResult = await client.query(
            "select customer_name, amount_cents, currency, status from invoices where id = $1",
            [result.invoiceId],
          );
          return [sourceRecordResult.rows[0], invoiceResult.rows[0]];
        },
      );

      // Proves the real trace identity (ADR 0029), not just that the FK
      // doesn't reject the write.
      expect(sourceRecordRow?.sync_job_id).toBe(job.id);
      expect(sourceRecordRow).toEqual({
        source_system: "quickbooks",
        source_object_type: "invoice",
        external_record_id: input.externalRecordId,
        sync_job_id: job.id,
      });
      expect(invoiceRow).toEqual({
        customer_name: input.customerName,
        amount_cents: String(input.amountCents),
        currency: input.currency,
        status: input.status,
      });
    });

    it("is idempotent for the same external record at the same source version", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
      );
      const input = fixtureInput(job.id);

      const first = await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        input,
      );
      const second = await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        input,
      );

      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(false);
      expect(second.sourceRecordId).toBeNull();
    });

    it("cannot see another organization's ingested invoices", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationA = await seedIntegration(pool, orgA.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        orgA.id,
        integrationA.id,
        "quickbooks",
        "invoice",
      );

      const result = await ingestQuickBooksInvoice(
        pool,
        orgA.id,
        integrationA.id,
        fixtureInput(job.id),
      );

      const rows = await withTenantContext(pool, orgB.id, async (client) => {
        const invoiceResult = await client.query(
          "select id from invoices where id = $1",
          [result.invoiceId],
        );
        return invoiceResult.rows;
      });

      expect(rows).toHaveLength(0);
    });

    it("transitions an invoice to paid, keyed by its source record", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
      );
      const input = fixtureInput(job.id);
      await ingestQuickBooksInvoice(pool, org.id, integration.id, input);

      const wasUpdated = await updateInvoiceStatusBySourceRecord(
        pool,
        org.id,
        "quickbooks",
        input.externalRecordId,
        "paid",
      );

      expect(wasUpdated).toBe(true);

      const status = await withTenantContext(pool, org.id, async (client) => {
        const result = await client.query<{ status: string }>(
          `select i.status from invoices i
           join source_records sr on sr.id = i.source_record_id
           where sr.external_record_id = $1`,
          [input.externalRecordId],
        );
        return result.rows[0]?.status;
      });

      expect(status).toBe("paid");
    });

    it("does not resurrect a void invoice as paid", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
      );
      const input = fixtureInput(job.id, { status: "void" });
      await ingestQuickBooksInvoice(pool, org.id, integration.id, input);

      const wasUpdated = await updateInvoiceStatusBySourceRecord(
        pool,
        org.id,
        "quickbooks",
        input.externalRecordId,
        "paid",
      );

      expect(wasUpdated).toBe(false);

      const status = await withTenantContext(pool, org.id, async (client) => {
        const result = await client.query<{ status: string }>(
          `select i.status from invoices i
           join source_records sr on sr.id = i.source_record_id
           where sr.external_record_id = $1`,
          [input.externalRecordId],
        );
        return result.rows[0]?.status;
      });

      expect(status).toBe("void");
    });

    it("returns false for an unknown source record", async () => {
      const org = await seedOrganization(pool);

      const wasUpdated = await updateInvoiceStatusBySourceRecord(
        pool,
        org.id,
        "quickbooks",
        "nonexistent-external-id",
        "paid",
      );

      expect(wasUpdated).toBe(false);
    });

    it("cannot update another organization's invoice", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationA = await seedIntegration(pool, orgA.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        orgA.id,
        integrationA.id,
        "quickbooks",
        "invoice",
      );
      const input = fixtureInput(job.id);
      await ingestQuickBooksInvoice(pool, orgA.id, integrationA.id, input);

      const wasUpdated = await updateInvoiceStatusBySourceRecord(
        pool,
        orgB.id,
        "quickbooks",
        input.externalRecordId,
        "paid",
      );

      expect(wasUpdated).toBe(false);
    });
  },
);

function xeroFixtureInput(
  syncJobId: string,
  overrides: Partial<Parameters<typeof ingestXeroInvoice>[3]> = {},
) {
  return {
    externalRecordId: `xero-invoice-${randomUUID()}`,
    sourceVersion: "2026-08-18T14:00:00.000Z",
    rawPayloadSha256: "b".repeat(64),
    rawPayloadByteLength: 512,
    observedAt: new Date(),
    customerName: "Acme Robotics",
    amountCents: 184_000,
    currency: "USD",
    dueAt: new Date("2026-08-30T00:00:00.000Z"),
    status: "open" as const,
    syncJobId,
    ...overrides,
  };
}

// Exercises ingestXeroInvoice against the live database — mirrors the
// QuickBooks suite above exactly (same shared `invoices` table, same
// append-only/idempotent semantics), only the fixture and source_system
// literal differ.
describe.skipIf(!process.env.DATABASE_URL)(
  "xero invoice sync (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("writes a real source_record and a matching invoice", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "xero",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "xero",
        "invoice",
      );
      const input = xeroFixtureInput(job.id);

      const result = await ingestXeroInvoice(
        pool,
        org.id,
        integration.id,
        input,
      );

      expect(result.inserted).toBe(true);
      expect(result.sourceRecordId).not.toBeNull();
      expect(result.invoiceId).not.toBeNull();

      const [sourceRecordRow, invoiceRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const sourceRecordResult = await client.query(
            "select source_system, source_object_type, external_record_id, sync_job_id from source_records where id = $1",
            [result.sourceRecordId],
          );
          const invoiceResult = await client.query(
            "select customer_name, amount_cents, currency, status from invoices where id = $1",
            [result.invoiceId],
          );
          return [sourceRecordResult.rows[0], invoiceResult.rows[0]];
        },
      );

      expect(sourceRecordRow?.sync_job_id).toBe(job.id);
      expect(sourceRecordRow).toEqual({
        source_system: "xero",
        source_object_type: "invoice",
        external_record_id: input.externalRecordId,
        sync_job_id: job.id,
      });
      expect(invoiceRow).toEqual({
        customer_name: input.customerName,
        amount_cents: String(input.amountCents),
        currency: input.currency,
        status: input.status,
      });
    });

    it("is idempotent for the same external record at the same source version", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "xero",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "xero",
        "invoice",
      );
      const input = xeroFixtureInput(job.id);

      const first = await ingestXeroInvoice(
        pool,
        org.id,
        integration.id,
        input,
      );
      const second = await ingestXeroInvoice(
        pool,
        org.id,
        integration.id,
        input,
      );

      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(false);
      expect(second.sourceRecordId).toBeNull();
    });

    it("cannot see another organization's ingested invoices", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationA = await seedIntegration(pool, orgA.id, {
        sourceSystem: "xero",
      });
      const job = await seedSyncJob(
        pool,
        orgA.id,
        integrationA.id,
        "xero",
        "invoice",
      );

      const result = await ingestXeroInvoice(
        pool,
        orgA.id,
        integrationA.id,
        xeroFixtureInput(job.id),
      );

      const rows = await withTenantContext(pool, orgB.id, async (client) => {
        const invoiceResult = await client.query(
          "select id from invoices where id = $1",
          [result.invoiceId],
        );
        return invoiceResult.rows;
      });

      expect(rows).toHaveLength(0);
    });

    it("transitions a Xero-sourced invoice to paid via the same provider-neutral update", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "xero",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "xero",
        "invoice",
      );
      const input = xeroFixtureInput(job.id);
      await ingestXeroInvoice(pool, org.id, integration.id, input);

      const wasUpdated = await updateInvoiceStatusBySourceRecord(
        pool,
        org.id,
        "xero",
        input.externalRecordId,
        "paid",
      );

      expect(wasUpdated).toBe(true);

      const status = await withTenantContext(pool, org.id, async (client) => {
        const result = await client.query<{ status: string }>(
          `select i.status from invoices i
           join source_records sr on sr.id = i.source_record_id
           where sr.external_record_id = $1`,
          [input.externalRecordId],
        );
        return result.rows[0]?.status;
      });

      expect(status).toBe("paid");
    });
  },
);

/**
 * Regression coverage for the P0 dedup fix: ingest is append-only
 * (`ingestQuickBooksInvoice`'s own doc comment) — a re-sync that observes
 * a new `source_version` for an already-known external record inserts a
 * brand-new `invoices` row rather than updating the old one in place.
 * Before this fix, `listOverdueInvoices` joined straight against
 * `invoices` with no dedup by external record, so a still-open re-synced
 * invoice (or a stale row left behind once the *latest* row was marked
 * paid) could surface as a second, ghost card on the live one-page
 * dashboard for the same real-world invoice.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "listOverdueInvoices (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("returns a real overdue open invoice from an active integration", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
      );
      const input = fixtureInput(job.id);
      await ingestQuickBooksInvoice(pool, org.id, integration.id, input);

      const overdue = await listOverdueInvoices(pool, org.id);

      expect(overdue).toHaveLength(1);
      expect(overdue[0]?.source.externalRecordId).toBe(input.externalRecordId);
      expect(overdue[0]?.amountCents).toBe(input.amountCents);
    });

    it("collapses a re-synced still-open invoice to one card, not two", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
      );
      const externalRecordId = `invoice-${randomUUID()}`;

      await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          externalRecordId,
          sourceVersion: "1",
          amountCents: 250_000,
        }),
      );
      // A re-sync that observes a partial payment: still open, still
      // overdue, but a new source_version — the exact ghost-row scenario.
      await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          externalRecordId,
          sourceVersion: "2",
          amountCents: 150_000,
        }),
      );

      const overdue = await listOverdueInvoices(pool, org.id);
      const matching = overdue.filter(
        (invoice) => invoice.source.externalRecordId === externalRecordId,
      );

      expect(matching).toHaveLength(1);
      // Reflects the latest observed state, not the first.
      expect(matching[0]?.amountCents).toBe(150_000);
      expect(matching[0]?.source.sourceVersion).toBe("2");
    });

    it("does not resurrect a stale open row once the latest re-sync is paid", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
      );
      const externalRecordId = `invoice-${randomUUID()}`;

      await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, { externalRecordId, sourceVersion: "1" }),
      );
      // A later re-sync observes the invoice is now fully paid — a second,
      // newer row with status "paid" alongside the old "open" one.
      await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          externalRecordId,
          sourceVersion: "2",
          status: "paid",
        }),
      );

      const overdue = await listOverdueInvoices(pool, org.id);

      expect(
        overdue.some(
          (invoice) => invoice.source.externalRecordId === externalRecordId,
        ),
      ).toBe(false);
    });
  },
);
