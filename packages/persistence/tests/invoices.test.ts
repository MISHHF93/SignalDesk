import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { ingestQuickBooksInvoice } from "../src/invoices";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

function fixtureInput(
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
      const input = fixtureInput();

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
            "select source_system, source_object_type, external_record_id from source_records where id = $1",
            [result.sourceRecordId],
          );
          const invoiceResult = await client.query(
            "select customer_name, amount_cents, currency, status from invoices where id = $1",
            [result.invoiceId],
          );
          return [sourceRecordResult.rows[0], invoiceResult.rows[0]];
        },
      );

      expect(sourceRecordRow).toEqual({
        source_system: "quickbooks",
        source_object_type: "invoice",
        external_record_id: input.externalRecordId,
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
      const input = fixtureInput();

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

      const result = await ingestQuickBooksInvoice(
        pool,
        orgA.id,
        integrationA.id,
        fixtureInput(),
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
  },
);
