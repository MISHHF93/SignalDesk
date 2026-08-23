import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { computeTimeToFirstSync } from "../src/onboarding-milestones";
import { completeSyncJob, failSyncJob, startSyncJob } from "../src/sync-jobs";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

/**
 * `organizations.created_at` is immutability-trigger-protected (0003,
 * `organizations_immutable_identity`) — an UPDATE is rejected, but the
 * trigger only fires `before update`, so a fresh INSERT may still set a
 * real historical value directly, which is what a live "signed up 10
 * minutes ago" fixture needs.
 */
async function seedOrganizationCreatedAt(
  pool: DatabasePool,
  createdAt: Date,
): Promise<{ id: string }> {
  const id = randomUUID();
  const slug = `org-${randomUUID()}`;

  await withTenantContext(pool, id, async (client) => {
    await client.query(
      `insert into organizations (id, slug, display_name, created_at)
       values ($1, $2, $3, $4)`,
      [id, slug, slug, createdAt],
    );
  });

  return { id };
}

describe.skipIf(!process.env.DATABASE_URL)(
  "computeTimeToFirstSync (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("reports no first sync yet for a brand-new organization", async () => {
      const org = await seedOrganization(pool);

      const result = await computeTimeToFirstSync(pool, org.id);

      expect(result.firstSuccessfulSyncAt).toBeNull();
      expect(result.minutesToFirstSync).toBeNull();
      expect(result.organizationCreatedAt).toBeInstanceOf(Date);
    });

    it("ignores a failed sync job — only a real succeeded run counts", async () => {
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
      await failSyncJob(pool, org.id, job.id, {
        itemsIngested: 0,
        itemsSkipped: 0,
        errorMessage: "boom",
      });

      const result = await computeTimeToFirstSync(pool, org.id);

      expect(result.firstSuccessfulSyncAt).toBeNull();
      expect(result.minutesToFirstSync).toBeNull();
    });

    it("computes real elapsed minutes from organization creation to first successful sync", async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const org = await seedOrganizationCreatedAt(pool, tenMinutesAgo);

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
      await completeSyncJob(pool, org.id, job.id, {
        itemsIngested: 3,
        itemsSkipped: 0,
        cursorAfter: "a",
      });

      const result = await computeTimeToFirstSync(pool, org.id);

      expect(result.firstSuccessfulSyncAt).toBeInstanceOf(Date);
      expect(result.minutesToFirstSync).not.toBeNull();
      expect(result.minutesToFirstSync ?? -1).toBeGreaterThanOrEqual(9);
      expect(result.minutesToFirstSync ?? -1).toBeLessThanOrEqual(11);
    });

    it("takes the earliest successful sync, not the latest", async () => {
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
        "initial",
        null,
      );
      await completeSyncJob(pool, org.id, firstJob.id, {
        itemsIngested: 1,
        itemsSkipped: 0,
        cursorAfter: "a",
      });
      const firstResult = await computeTimeToFirstSync(pool, org.id);

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
        itemsIngested: 1,
        itemsSkipped: 0,
        cursorAfter: "b",
      });
      const secondResult = await computeTimeToFirstSync(pool, org.id);

      expect(secondResult.firstSuccessfulSyncAt).toEqual(
        firstResult.firstSuccessfulSyncAt,
      );
    });

    it("throws for an organization that does not exist", async () => {
      await expect(
        computeTimeToFirstSync(pool, "11111111-1111-4111-8111-111111111111"),
      ).rejects.toThrow(/not found/i);
    });
  },
);
