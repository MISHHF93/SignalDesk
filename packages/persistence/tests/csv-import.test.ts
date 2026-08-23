import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  ensureCsvImportIntegration,
  getCsvImportSummary,
  ingestCsvInvoice,
} from "../src/csv-import";
import { getTestPool, seedOrganization, seedSyncJob } from "./support";

describe.skipIf(!process.env.DATABASE_URL)("csv import (live database)", () => {
  let pool: DatabasePool;

  beforeAll(() => {
    pool = getTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  async function seedCsvSyncJob(organizationId: string, integrationId: string) {
    const job = await seedSyncJob(
      pool,
      organizationId,
      integrationId,
      "csv_import",
      "invoice",
    );
    return job.id;
  }

  it("creates the synthetic csv_import integration once and reuses it on a second call", async () => {
    const org = await seedOrganization(pool);

    const first = await ensureCsvImportIntegration(pool, org.id);
    const second = await ensureCsvImportIntegration(pool, org.id);

    expect(first.id).toBe(second.id);
  });

  it("ingests a real invoice through the csv_import provenance chain", async () => {
    const org = await seedOrganization(pool);
    const integration = await ensureCsvImportIntegration(pool, org.id);
    const syncJobId = await seedCsvSyncJob(org.id, integration.id);

    const result = await ingestCsvInvoice(pool, org.id, integration.id, {
      contentHash: "hash-1",
      customerName: "Acme Co",
      amountCents: 250_000,
      currency: "USD",
      dueAt: new Date("2026-08-01T00:00:00.000Z"),
      status: "open",
      syncJobId,
    });

    expect(result.inserted).toBe(true);
    expect(typeof result.invoiceId).toBe("string");
  });

  it("is idempotent on the same content hash — a re-import is not a duplicate", async () => {
    const org = await seedOrganization(pool);
    const integration = await ensureCsvImportIntegration(pool, org.id);
    const syncJobId = await seedCsvSyncJob(org.id, integration.id);
    const input = {
      contentHash: "hash-dupe",
      customerName: "Acme Co",
      amountCents: 250_000,
      currency: "USD",
      dueAt: new Date("2026-08-01T00:00:00.000Z"),
      status: "open" as const,
      syncJobId,
    };

    const first = await ingestCsvInvoice(pool, org.id, integration.id, input);
    const second = await ingestCsvInvoice(pool, org.id, integration.id, input);

    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.invoiceId).toBeNull();
  });

  it("summarizes real CSV-imported invoice counts, distinct per organization", async () => {
    const orgA = await seedOrganization(pool);
    const orgB = await seedOrganization(pool);
    const integrationA = await ensureCsvImportIntegration(pool, orgA.id);
    const syncJobId = await seedCsvSyncJob(orgA.id, integrationA.id);

    await ingestCsvInvoice(pool, orgA.id, integrationA.id, {
      contentHash: "hash-a1",
      customerName: "Acme Co",
      amountCents: 100_000,
      currency: "USD",
      dueAt: new Date("2026-08-01T00:00:00.000Z"),
      status: "open",
      syncJobId,
    });

    const summaryA = await getCsvImportSummary(pool, orgA.id);
    const summaryB = await getCsvImportSummary(pool, orgB.id);

    expect(summaryA.invoiceCount).toBe(1);
    expect(summaryA.lastImportedAt).toBeInstanceOf(Date);
    expect(summaryB.invoiceCount).toBe(0);
    expect(summaryB.lastImportedAt).toBeNull();
  });
});
