import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { getConnectorConnection } from "../src/connector-connection";
import { disconnectQuickBooksIntegration } from "../src/quickbooks-integration";
import {
  completeSyncJob,
  failSyncJob,
  listRecentSyncJobsForConnection,
  startSyncJob,
} from "../src/sync-jobs";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

describe.skipIf(!process.env.DATABASE_URL)("sync jobs (live database)", () => {
  let pool: DatabasePool;

  beforeAll(() => {
    pool = getTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("starts a job in the running state with no cursor yet", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "quickbooks",
    });

    const job = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "quickbooks",
      "invoice",
      "initial",
      null,
    );

    expect(job.status).toBe("running");
    expect(job.trigger).toBe("initial");
    expect(job.cursorBefore).toBeNull();
    expect(job.cursorAfter).toBeNull();
    expect(job.completedAt).toBeNull();
  });

  it("completes a job with real counts and a computed cursor", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "quickbooks",
    });
    const job = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "quickbooks",
      "invoice",
      "manual",
      "2026-08-01T00:00:00.000Z",
    );

    const completed = await completeSyncJob(pool, org.id, job.id, {
      itemsIngested: 12,
      itemsSkipped: 2,
      cursorAfter: "2026-08-19T12:00:00.000Z",
    });

    expect(completed.status).toBe("succeeded");
    expect(completed.itemsIngested).toBe(12);
    expect(completed.itemsSkipped).toBe(2);
    expect(completed.cursorBefore).toBe("2026-08-01T00:00:00.000Z");
    expect(completed.cursorAfter).toBe("2026-08-19T12:00:00.000Z");
    expect(completed.completedAt).toBeInstanceOf(Date);
  });

  it("fails a job with a real error message", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "hubspot",
    });
    const job = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "hubspot",
      "lead",
      "manual",
      null,
    );

    const failed = await failSyncJob(pool, org.id, job.id, {
      itemsIngested: 3,
      itemsSkipped: 0,
      errorMessage: "HubSpot API returned 500",
    });

    expect(failed.status).toBe("failed");
    expect(failed.errorMessage).toBe("HubSpot API returned 500");
    expect(failed.itemsIngested).toBe(3);
  });

  it("throws completing a job that does not exist", async () => {
    const org = await seedOrganization(pool);

    await expect(
      completeSyncJob(pool, org.id, "11111111-1111-4111-8111-111111111111", {
        itemsIngested: 0,
        itemsSkipped: 0,
        cursorAfter: null,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("lists an integration's jobs newest first", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "asana",
    });

    const first = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "asana",
      "task",
      "initial",
      null,
    );
    await completeSyncJob(pool, org.id, first.id, {
      itemsIngested: 1,
      itemsSkipped: 0,
      cursorAfter: "a",
    });
    const second = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "asana",
      "task",
      "manual",
      "a",
    );
    await completeSyncJob(pool, org.id, second.id, {
      itemsIngested: 2,
      itemsSkipped: 0,
      cursorAfter: "b",
    });

    const jobs = await listRecentSyncJobsForConnection(
      pool,
      org.id,
      integration.id,
    );
    const ids = jobs.map((job) => job.id);

    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });

  it("starts a webhook-triggered job and records its entity type", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "quickbooks",
    });

    const job = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "quickbooks",
      "payment",
      "webhook",
      null,
    );

    expect(job.trigger).toBe("webhook");
    expect(job.entityType).toBe("payment");
  });

  it("scopes the previous-job lookup to a single entity type", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "quickbooks",
    });

    const invoiceJob = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "quickbooks",
      "invoice",
      "initial",
      null,
    );
    await completeSyncJob(pool, org.id, invoiceJob.id, {
      itemsIngested: 1,
      itemsSkipped: 0,
      cursorAfter: "invoice-cursor-1",
    });
    const paymentJob = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "quickbooks",
      "payment",
      "initial",
      null,
    );
    await completeSyncJob(pool, org.id, paymentJob.id, {
      itemsIngested: 1,
      itemsSkipped: 0,
      cursorAfter: "payment-cursor-1",
    });

    const [latestInvoiceJob] = await listRecentSyncJobsForConnection(
      pool,
      org.id,
      integration.id,
      1,
      "invoice",
    );
    const [latestPaymentJob] = await listRecentSyncJobsForConnection(
      pool,
      org.id,
      integration.id,
      1,
      "payment",
    );

    expect(latestInvoiceJob?.cursorAfter).toBe("invoice-cursor-1");
    expect(latestPaymentJob?.cursorAfter).toBe("payment-cursor-1");
  });

  it("marks the connection degraded when a completed job skipped records", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "quickbooks",
    });
    const job = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "quickbooks",
      "invoice",
      "manual",
      null,
    );

    await completeSyncJob(pool, org.id, job.id, {
      itemsIngested: 5,
      itemsSkipped: 1,
      cursorAfter: "a",
    });

    const connection = await getConnectorConnection(
      pool,
      org.id,
      integration.id,
    );

    expect(connection?.status).toBe("degraded");
  });

  it("recovers a degraded connection once a later job skips nothing", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "quickbooks",
    });
    const firstJob = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "quickbooks",
      "invoice",
      "manual",
      null,
    );
    await completeSyncJob(pool, org.id, firstJob.id, {
      itemsIngested: 5,
      itemsSkipped: 1,
      cursorAfter: "a",
    });

    const secondJob = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "quickbooks",
      "invoice",
      "manual",
      "a",
    );
    await completeSyncJob(pool, org.id, secondJob.id, {
      itemsIngested: 3,
      itemsSkipped: 0,
      cursorAfter: "b",
    });

    const connection = await getConnectorConnection(
      pool,
      org.id,
      integration.id,
    );

    expect(connection?.status).toBe("active");
  });

  it("never resurrects a disconnected integration into degraded or active", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "quickbooks",
    });
    const job = await startSyncJob(
      pool,
      org.id,
      integration.id,
      "quickbooks",
      "invoice",
      "manual",
      null,
    );

    await disconnectQuickBooksIntegration(pool, org.id, integration.id);
    await completeSyncJob(pool, org.id, job.id, {
      itemsIngested: 0,
      itemsSkipped: 1,
      cursorAfter: null,
    });

    const connection = await getConnectorConnection(
      pool,
      org.id,
      integration.id,
    );

    expect(connection?.status).toBe("disconnected");
  });

  it("does not return another organization's sync jobs", async () => {
    const orgA = await seedOrganization(pool);
    const orgB = await seedOrganization(pool);
    const integrationB = await seedIntegration(pool, orgB.id, {
      sourceSystem: "quickbooks",
    });

    await startSyncJob(
      pool,
      orgB.id,
      integrationB.id,
      "quickbooks",
      "invoice",
      "initial",
      null,
    );

    const jobsFromOrgA = await listRecentSyncJobsForConnection(
      pool,
      orgA.id,
      integrationB.id,
    );

    expect(jobsFromOrgA).toEqual([]);
  });
});
