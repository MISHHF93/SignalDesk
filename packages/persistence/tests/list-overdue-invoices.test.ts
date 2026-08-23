import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { ingestQuickBooksInvoice, listOverdueInvoices } from "../src/invoices";
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

// Exercises listOverdueInvoices against the live database — the join
// across invoices/source_records/integrations, the "open and past due"
// filter, ordering, and the active-integration-only filter.
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

    it("returns an empty list for an organization with no invoices yet", async () => {
      const org = await seedOrganization(pool);

      const invoices = await listOverdueInvoices(pool, org.id);

      expect(invoices).toEqual([]);
    });

    it("does not surface an invoice that isn't due yet", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
      );

      await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, { dueAt: farFuture }),
      );

      const invoices = await listOverdueInvoices(pool, org.id);

      expect(invoices).toEqual([]);
    });

    it("reads back a real overdue invoice with correct source provenance", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const pastDue = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
      );
      const input = fixtureInput(job.id, { dueAt: pastDue });

      const ingestResult = await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        input,
      );

      const invoices = await listOverdueInvoices(pool, org.id);

      expect(invoices).toHaveLength(1);
      const invoice = invoices[0];
      expect(invoice?.id).toBe(ingestResult.invoiceId);
      expect(invoice?.customerName).toBe(input.customerName);
      expect(invoice?.amountCents).toBe(input.amountCents);
      expect(invoice?.currency).toBe(input.currency);
      expect(invoice?.status).toBe("open");
      expect(invoice?.source.system).toBe("quickbooks");
      expect(invoice?.source.integrationId).toBe(integration.id);
      expect(invoice?.source.externalRecordId).toBe(input.externalRecordId);
    });

    it("orders overdue invoices oldest-due-first", async () => {
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
      const recentlyOverdue = await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        }),
      );
      const longOverdue = await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          dueAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        }),
      );

      const invoices = await listOverdueInvoices(pool, org.id);

      expect(invoices.map((invoice) => invoice.id)).toEqual([
        longOverdue.invoiceId,
        recentlyOverdue.invoiceId,
      ]);
    });

    it("cannot see another organization's overdue invoices", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await seedIntegration(pool, orgB.id, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        orgB.id,
        integrationB.id,
        "quickbooks",
        "invoice",
      );

      await ingestQuickBooksInvoice(
        pool,
        orgB.id,
        integrationB.id,
        fixtureInput(job.id, { dueAt: new Date(Date.now() - 1000) }),
      );

      const invoices = await listOverdueInvoices(pool, orgA.id);

      expect(invoices).toEqual([]);
    });

    it("stops surfacing an invoice once its source integration is disconnected", async () => {
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
      await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, { dueAt: new Date(Date.now() - 1000) }),
      );

      expect(await listOverdueInvoices(pool, org.id)).toHaveLength(1);

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [integration.id],
        );
      });

      const invoices = await listOverdueInvoices(pool, org.id);

      expect(invoices).toEqual([]);
    });

    it("still surfaces an invoice when its source integration is degraded, not disconnected", async () => {
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
      await ingestQuickBooksInvoice(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, { dueAt: new Date(Date.now() - 1000) }),
      );

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'degraded' where id = $1",
          [integration.id],
        );
      });

      const invoices = await listOverdueInvoices(pool, org.id);

      expect(invoices).toHaveLength(1);
    });
  },
);
