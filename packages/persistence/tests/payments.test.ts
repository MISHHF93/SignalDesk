import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { ingestQuickBooksPayment, listRecentPayments } from "../src/payments";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedOrganization,
  seedSyncJob,
} from "./support";

function fixtureInput(
  syncJobId: string,
  overrides: Partial<Parameters<typeof ingestQuickBooksPayment>[3]> = {},
) {
  return {
    externalRecordId: `payment-${randomUUID()}`,
    sourceVersion: "0",
    rawPayloadSha256: "a".repeat(64),
    rawPayloadByteLength: 512,
    observedAt: new Date(),
    customerName: "Acme Robotics",
    amountCents: 150_000,
    currency: "USD",
    receivedAt: new Date("2026-08-18T00:00:00.000Z"),
    invoiceAllocations: [{ externalInvoiceId: "148", amountCents: 150_000 }],
    syncJobId,
    ...overrides,
  };
}

// Exercises ingestQuickBooksPayment against the live database: a real
// source_records → payments write, idempotency on repeat ingestion of the
// same source_version, and tenant isolation — mirrors invoices.test.ts.
describe.skipIf(!process.env.DATABASE_URL)(
  "quickbooks payment sync (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("writes a real source_record and a matching payment", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "payment",
      );
      const input = fixtureInput(job.id);

      const result = await ingestQuickBooksPayment(
        pool,
        org.id,
        integration.id,
        input,
      );

      expect(result.inserted).toBe(true);
      expect(result.sourceRecordId).not.toBeNull();
      expect(result.paymentId).not.toBeNull();

      const [sourceRecordRow, paymentRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const sourceRecordResult = await client.query(
            "select source_system, source_object_type, external_record_id from source_records where id = $1",
            [result.sourceRecordId],
          );
          const paymentResult = await client.query(
            "select customer_name, amount_cents, currency, invoice_allocations from payments where id = $1",
            [result.paymentId],
          );
          return [sourceRecordResult.rows[0], paymentResult.rows[0]];
        },
      );

      expect(sourceRecordRow).toEqual({
        source_system: "quickbooks",
        source_object_type: "payment",
        external_record_id: input.externalRecordId,
      });
      expect(paymentRow).toEqual({
        customer_name: input.customerName,
        amount_cents: String(input.amountCents),
        currency: input.currency,
        invoice_allocations: input.invoiceAllocations,
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
        "payment",
      );
      const input = fixtureInput(job.id);

      const first = await ingestQuickBooksPayment(
        pool,
        org.id,
        integration.id,
        input,
      );
      const second = await ingestQuickBooksPayment(
        pool,
        org.id,
        integration.id,
        input,
      );

      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(false);
      expect(second.sourceRecordId).toBeNull();
    });

    it("cannot see another organization's ingested payments", async () => {
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
        "payment",
      );

      const result = await ingestQuickBooksPayment(
        pool,
        orgA.id,
        integrationA.id,
        fixtureInput(job.id),
      );

      const rows = await withTenantContext(pool, orgB.id, async (client) => {
        const paymentResult = await client.query(
          "select id from payments where id = $1",
          [result.paymentId],
        );
        return paymentResult.rows;
      });

      expect(rows).toHaveLength(0);
    });

    it("lists recent payments for an active connection, newest first", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "payment",
      );

      await ingestQuickBooksPayment(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          receivedAt: new Date("2026-08-10T00:00:00.000Z"),
        }),
      );
      await ingestQuickBooksPayment(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          receivedAt: new Date("2026-08-18T00:00:00.000Z"),
        }),
      );

      const payments = await listRecentPayments(pool, org.id);

      expect(payments).toHaveLength(2);
      expect(payments[0]?.receivedAt).toEqual(
        new Date("2026-08-18T00:00:00.000Z"),
      );
    });

    it("still lists a payment when its source integration is degraded, not disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "payment",
      );

      await ingestQuickBooksPayment(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id),
      );

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'degraded' where id = $1",
          [integration.id],
        );
      });

      const payments = await listRecentPayments(pool, org.id);

      expect(payments).toHaveLength(1);
    });

    it("stops listing a payment once its source integration is disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "payment",
      );

      await ingestQuickBooksPayment(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id),
      );

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [integration.id],
        );
      });

      const payments = await listRecentPayments(pool, org.id);

      expect(payments).toEqual([]);
    });
  },
);
