import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { provisionIdentityAndOrganization } from "../src/identity";
import {
  ingestAsanaTask,
  ingestJiraIssue,
  listOverdueTasks,
} from "../src/tasks";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedOrganization,
  seedSyncJob,
} from "./support";

function fixtureInput(
  syncJobId: string,
  overrides: Partial<Parameters<typeof ingestAsanaTask>[3]> = {},
) {
  return {
    externalRecordId: `task-${randomUUID()}`,
    sourceVersion: "2026-08-17T11:55:00.000Z",
    rawPayloadSha256: "a".repeat(64),
    rawPayloadByteLength: 512,
    observedAt: new Date(),
    name: "Ship Q3 report",
    assigneeName: "Jordan Lee",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
    completed: false,
    syncJobId,
    ...overrides,
  };
}

// Exercises ingestAsanaTask against the live database: a real
// source_records → tasks write, idempotency on repeat ingestion of the
// same source_version, and tenant isolation.
describe.skipIf(!process.env.DATABASE_URL)(
  "asana task sync (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("writes a real source_record and a matching task", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "asana",
        "task",
      );
      const input = fixtureInput(job.id);

      const result = await ingestAsanaTask(pool, org.id, integration.id, input);

      expect(result.inserted).toBe(true);
      expect(result.sourceRecordId).not.toBeNull();
      expect(result.taskId).not.toBeNull();

      const [sourceRecordRow, taskRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const sourceRecordResult = await client.query(
            "select source_system, source_object_type, external_record_id from source_records where id = $1",
            [result.sourceRecordId],
          );
          const taskResult = await client.query(
            "select name, assignee_name, completed from tasks where id = $1",
            [result.taskId],
          );
          return [sourceRecordResult.rows[0], taskResult.rows[0]];
        },
      );

      expect(sourceRecordRow).toEqual({
        source_system: "asana",
        source_object_type: "task",
        external_record_id: input.externalRecordId,
      });
      expect(taskRow).toEqual({
        name: input.name,
        assignee_name: input.assigneeName,
        completed: input.completed,
      });
    });

    it("is idempotent for the same external record at the same source version", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "asana",
        "task",
      );
      const input = fixtureInput(job.id);

      const first = await ingestAsanaTask(pool, org.id, integration.id, input);
      const second = await ingestAsanaTask(pool, org.id, integration.id, input);

      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(false);
      expect(second.sourceRecordId).toBeNull();
    });

    it("cannot see another organization's ingested tasks", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationA = await seedIntegration(pool, orgA.id, {
        sourceSystem: "asana",
      });
      const job = await seedSyncJob(
        pool,
        orgA.id,
        integrationA.id,
        "asana",
        "task",
      );

      const result = await ingestAsanaTask(
        pool,
        orgA.id,
        integrationA.id,
        fixtureInput(job.id),
      );

      const rows = await withTenantContext(pool, orgB.id, async (client) => {
        const taskResult = await client.query(
          "select id from tasks where id = $1",
          [result.taskId],
        );
        return taskResult.rows;
      });

      expect(rows).toHaveLength(0);
    });

    it("resolves owner_membership_id when assigneeName exactly matches a real member's display name", async () => {
      const displayName = `Jordan Lee ${randomUUID()}`;
      const { organizationId } = await provisionIdentityAndOrganization(pool, {
        identityProvider: "test",
        identityProviderSubject: `subject-${randomUUID()}`,
        displayName,
        primaryEmail: `${randomUUID()}@example.com`,
      });
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "asana",
      });
      const job = await seedSyncJob(
        pool,
        organizationId,
        integration.id,
        "asana",
        "task",
      );

      const result = await ingestAsanaTask(
        pool,
        organizationId,
        integration.id,
        fixtureInput(job.id, { assigneeName: displayName }),
      );

      const [taskRow] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const taskResult = await client.query(
            "select owner_membership_id from tasks where id = $1",
            [result.taskId],
          );
          return taskResult.rows;
        },
      );

      expect(taskRow?.owner_membership_id).not.toBeNull();
    });

    it("leaves owner_membership_id null when assigneeName matches no real member", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "asana",
        "task",
      );

      const result = await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, { assigneeName: "Nobody Real" }),
      );

      const [taskRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const taskResult = await client.query(
            "select owner_membership_id from tasks where id = $1",
            [result.taskId],
          );
          return taskResult.rows;
        },
      );

      expect(taskRow?.owner_membership_id).toBeNull();
    });
  },
);

function jiraFixtureInput(
  syncJobId: string,
  overrides: Partial<Parameters<typeof ingestJiraIssue>[3]> = {},
) {
  return {
    externalRecordId: `jira-issue-${randomUUID()}`,
    sourceVersion: "2026-08-18T13:56:00.000+0000",
    rawPayloadSha256: "c".repeat(64),
    rawPayloadByteLength: 512,
    observedAt: new Date(),
    name: "Fix the thing",
    assigneeName: "Jamie Rivera",
    dueAt: new Date("2026-09-01T00:00:00.000Z"),
    completed: false,
    syncJobId,
    ...overrides,
  };
}

// Exercises ingestJiraIssue against the live database — mirrors the
// Asana suite above exactly (same shared `tasks` table, same append-only/
// idempotent semantics), only the fixture and source_system literal
// differ.
describe.skipIf(!process.env.DATABASE_URL)(
  "jira issue sync (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("writes a real source_record and a matching task", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "jira",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "jira",
        "task",
      );
      const input = jiraFixtureInput(job.id);

      const result = await ingestJiraIssue(pool, org.id, integration.id, input);

      expect(result.inserted).toBe(true);
      expect(result.sourceRecordId).not.toBeNull();
      expect(result.taskId).not.toBeNull();

      const [sourceRecordRow, taskRow] = await withTenantContext(
        pool,
        org.id,
        async (client) => {
          const sourceRecordResult = await client.query(
            "select source_system, source_object_type, external_record_id from source_records where id = $1",
            [result.sourceRecordId],
          );
          const taskResult = await client.query(
            "select name, assignee_name, completed from tasks where id = $1",
            [result.taskId],
          );
          return [sourceRecordResult.rows[0], taskResult.rows[0]];
        },
      );

      expect(sourceRecordRow).toEqual({
        source_system: "jira",
        source_object_type: "issue",
        external_record_id: input.externalRecordId,
      });
      expect(taskRow).toEqual({
        name: input.name,
        assignee_name: input.assigneeName,
        completed: input.completed,
      });
    });

    it("is idempotent for the same external record at the same source version", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "jira",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "jira",
        "task",
      );
      const input = jiraFixtureInput(job.id);

      const first = await ingestJiraIssue(pool, org.id, integration.id, input);
      const second = await ingestJiraIssue(pool, org.id, integration.id, input);

      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(false);
      expect(second.sourceRecordId).toBeNull();
    });

    it("cannot see another organization's ingested tasks", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationA = await seedIntegration(pool, orgA.id, {
        sourceSystem: "jira",
      });
      const job = await seedSyncJob(
        pool,
        orgA.id,
        integrationA.id,
        "jira",
        "task",
      );

      const result = await ingestJiraIssue(
        pool,
        orgA.id,
        integrationA.id,
        jiraFixtureInput(job.id),
      );

      const rows = await withTenantContext(pool, orgB.id, async (client) => {
        const taskResult = await client.query(
          "select id from tasks where id = $1",
          [result.taskId],
        );
        return taskResult.rows;
      });

      expect(rows).toHaveLength(0);
    });

    it("resolves owner_membership_id when assigneeName exactly matches a real member's display name", async () => {
      const displayName = `Jamie Rivera ${randomUUID()}`;
      const { organizationId } = await provisionIdentityAndOrganization(pool, {
        identityProvider: "test",
        identityProviderSubject: `subject-${randomUUID()}`,
        displayName,
        primaryEmail: `${randomUUID()}@example.com`,
      });
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "jira",
      });
      const job = await seedSyncJob(
        pool,
        organizationId,
        integration.id,
        "jira",
        "task",
      );

      const result = await ingestJiraIssue(
        pool,
        organizationId,
        integration.id,
        jiraFixtureInput(job.id, { assigneeName: displayName }),
      );

      const [taskRow] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const taskResult = await client.query(
            "select owner_membership_id from tasks where id = $1",
            [result.taskId],
          );
          return taskResult.rows;
        },
      );

      expect(taskRow?.owner_membership_id).not.toBeNull();
    });
  },
);

/**
 * Regression coverage for the P0 dedup fix (mirrors `listOverdueInvoices`'s
 * own regression suite): ingest is append-only, so a re-sync that observes
 * a new `source_version` for an already-known external record inserts a
 * brand-new `tasks` row rather than updating the old one in place. Before
 * this fix, `listOverdueTasks` joined straight against `tasks` with no
 * dedup by external record, so a still-incomplete re-synced task could
 * surface as a second, ghost card on the live one-page dashboard.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "listOverdueTasks (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("returns a real overdue incomplete task from an active integration", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "asana",
        "task",
      );
      const input = fixtureInput(job.id);
      await ingestAsanaTask(pool, org.id, integration.id, input);

      const overdue = await listOverdueTasks(pool, org.id);

      expect(overdue).toHaveLength(1);
      expect(overdue[0]?.source.externalRecordId).toBe(input.externalRecordId);
      expect(overdue[0]?.name).toBe(input.name);
    });

    it("collapses a re-synced still-incomplete task to one card, not two", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "asana",
        "task",
      );
      const externalRecordId = `task-${randomUUID()}`;

      await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          externalRecordId,
          sourceVersion: "2026-08-17T11:55:00.000Z",
          name: "Ship Q3 report",
        }),
      );
      // A re-sync that observes an edit (e.g. renamed): still incomplete,
      // still overdue, but a new source_version — the ghost-row scenario.
      await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          externalRecordId,
          sourceVersion: "2026-08-18T09:00:00.000Z",
          name: "Ship Q3 report (final)",
        }),
      );

      const overdue = await listOverdueTasks(pool, org.id);
      const matching = overdue.filter(
        (task) => task.source.externalRecordId === externalRecordId,
      );

      expect(matching).toHaveLength(1);
      // Reflects the latest observed state, not the first.
      expect(matching[0]?.name).toBe("Ship Q3 report (final)");
      expect(matching[0]?.source.sourceVersion).toBe(
        "2026-08-18T09:00:00.000Z",
      );
    });

    it("does not resurrect a stale incomplete row once the latest re-sync is completed", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "asana",
      });
      const job = await seedSyncJob(
        pool,
        org.id,
        integration.id,
        "asana",
        "task",
      );
      const externalRecordId = `task-${randomUUID()}`;

      await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          externalRecordId,
          sourceVersion: "2026-08-17T11:55:00.000Z",
        }),
      );
      // A later re-sync observes the task is now complete — a second,
      // newer row with completed=true alongside the old incomplete one.
      await ingestAsanaTask(
        pool,
        org.id,
        integration.id,
        fixtureInput(job.id, {
          externalRecordId,
          sourceVersion: "2026-08-18T09:00:00.000Z",
          completed: true,
        }),
      );

      const overdue = await listOverdueTasks(pool, org.id);

      expect(
        overdue.some(
          (task) => task.source.externalRecordId === externalRecordId,
        ),
      ).toBe(false);
    });
  },
);
