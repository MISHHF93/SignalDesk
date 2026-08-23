import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { computeConnectorHealth } from "../src/connector-health";
import { completeSyncJob, failSyncJob, startSyncJob } from "../src/sync-jobs";
import { getTestPool, seedIntegration, seedOrganization } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "computeConnectorHealth (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("reports unknown when no sync job has ever run", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });

      const health = await computeConnectorHealth(pool, org.id, integration.id);

      expect(health.status).toBe("unknown");
      expect(health.lastSuccessfulSyncAt).toBeNull();
      expect(health.lastAttemptedSyncAt).toBeNull();
      expect(health.freshnessMinutes).toBeNull();
    });

    it("reports unknown while the latest job is still running", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      await startSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
        "initial",
        null,
      );

      const health = await computeConnectorHealth(pool, org.id, integration.id);

      expect(health.status).toBe("unknown");
    });

    it("reports healthy with a real freshness value after one successful sync", async () => {
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
      const completed = await completeSyncJob(pool, org.id, job.id, {
        itemsIngested: 5,
        itemsSkipped: 0,
        cursorAfter: "cursor-1",
      });

      const now = new Date(completed.completedAt!.getTime() + 10 * 60_000);
      const health = await computeConnectorHealth(
        pool,
        org.id,
        integration.id,
        now,
      );

      expect(health.status).toBe("healthy");
      expect(health.lastSuccessfulSyncAt).toEqual(completed.completedAt);
      expect(health.freshnessMinutes).toBe(10);
      expect(health.lastError).toBeNull();
    });

    it("reports degraded when the latest job failed but an earlier one succeeded", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "quickbooks",
      });
      const first = await startSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
        "initial",
        null,
      );
      await completeSyncJob(pool, org.id, first.id, {
        itemsIngested: 5,
        itemsSkipped: 0,
        cursorAfter: "cursor-1",
      });
      const second = await startSyncJob(
        pool,
        org.id,
        integration.id,
        "quickbooks",
        "invoice",
        "manual",
        "cursor-1",
      );
      await failSyncJob(pool, org.id, second.id, {
        itemsIngested: 0,
        itemsSkipped: 0,
        errorMessage: "token refresh failed",
      });

      const health = await computeConnectorHealth(pool, org.id, integration.id);

      expect(health.status).toBe("degraded");
      expect(health.lastSuccessfulSyncAt).not.toBeNull();
      expect(health.lastError).toBe("token refresh failed");
    });

    it("reports error when the connector has never synced successfully", async () => {
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
        errorMessage: "invalid credentials",
      });

      const health = await computeConnectorHealth(pool, org.id, integration.id);

      expect(health.status).toBe("error");
      expect(health.lastSuccessfulSyncAt).toBeNull();
      expect(health.lastError).toBe("invalid credentials");
    });
  },
);
