import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startAgentCollaboration } from "../src/agent-collaborations";
import {
  beginAsanaTaskNudgeSend,
  completeAsanaTaskNudgeSend,
} from "../src/asana-task-nudges";
import type { DatabasePool } from "../src/client";
import { ingestAsanaTask } from "../src/tasks";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedMembership,
  seedSyncJob,
} from "./support";

async function seedCollaborationForTask(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  taskId: string,
  idempotencyKey: string,
): Promise<{ id: string }> {
  const collaboration = await startAgentCollaboration(pool, organizationId, {
    userId,
    pattern: "single_specialist",
    objective: "Draft a nudge comment on this task.",
    correlationId: idempotencyKey,
    idempotencyKey,
    taskId,
  });

  return { id: collaboration.id };
}

describe.skipIf(!process.env.DATABASE_URL)(
  "asana task nudges (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    async function seedFixture(idempotencyKey: string) {
      const { organizationId, userId } = await seedMembership(pool);
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
      const ingested = await ingestAsanaTask(
        pool,
        organizationId,
        integration.id,
        {
          externalRecordId: `task-${randomUUID()}`,
          sourceVersion: "v1",
          rawPayloadSha256: "c".repeat(64),
          rawPayloadByteLength: 10,
          observedAt: new Date(),
          name: "Follow up with customer",
          assigneeName: null,
          dueAt: new Date(),
          completed: false,
          syncJobId: job.id,
        },
      );
      const taskId = ingested.taskId!;
      const collaboration = await seedCollaborationForTask(
        pool,
        organizationId,
        userId,
        taskId,
        `${idempotencyKey}:collaboration`,
      );

      return { organizationId, userId, taskId, collaboration };
    }

    it("begins a fresh send as 'pending', not resolved yet", async () => {
      const { organizationId, userId, taskId, collaboration } =
        await seedFixture("begin-fresh");

      const result = await beginAsanaTaskNudgeSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        taskId,
        body: "Following up — any update on this?",
        idempotencyKey: "begin-fresh:send",
      });

      expect(result.alreadyResolved).toBeNull();

      const row = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const queryResult = await client.query(
            "select status, body, asana_story_gid, sent_at, failure_reason from asana_task_nudges where id = $1",
            [result.id],
          );
          return queryResult.rows[0];
        },
      );

      expect(row).toEqual({
        status: "pending",
        body: "Following up — any update on this?",
        asana_story_gid: null,
        sent_at: null,
        failure_reason: null,
      });
    });

    it("returns alreadyResolved: 'pending' on a replay while still pending — never a second Asana call", async () => {
      const { organizationId, userId, taskId, collaboration } =
        await seedFixture("begin-pending-replay");

      const first = await beginAsanaTaskNudgeSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        taskId,
        body: "Any update on this?",
        idempotencyKey: "begin-pending-replay:send",
      });
      const second = await beginAsanaTaskNudgeSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        taskId,
        body: "Any update on this?",
        idempotencyKey: "begin-pending-replay:send",
      });

      expect(first.id).toBe(second.id);
      expect(second.alreadyResolved).toBe("pending");
    });

    it("completes a send as 'sent' with a real, correctly attributed audit event", async () => {
      const { organizationId, userId, taskId, collaboration } =
        await seedFixture("complete-sent");

      const begun = await beginAsanaTaskNudgeSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        taskId,
        body: "Following up — any update on this?",
        idempotencyKey: "complete-sent:send",
      });

      await completeAsanaTaskNudgeSend(pool, organizationId, userId, begun.id, {
        status: "sent",
        sentAt: new Date(),
        storyGid: "asana-story-1",
      });

      const [nudgeRow, auditRows] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const nudgeResult = await client.query(
            "select status, asana_story_gid, sent_at from asana_task_nudges where id = $1",
            [begun.id],
          );
          const auditResult = await client.query(
            "select event_type, outcome, actor_kind, subject_id from audit_events where subject_id = $1",
            [begun.id],
          );
          return [nudgeResult.rows[0], auditResult.rows];
        },
      );

      expect(nudgeRow.status).toBe("sent");
      expect(nudgeRow.asana_story_gid).toBe("asana-story-1");
      expect(nudgeRow.sent_at).toBeInstanceOf(Date);

      expect(auditRows).toHaveLength(1);
      expect(auditRows[0]).toEqual({
        event_type: "asana_task_nudge.sent",
        outcome: "succeeded",
        actor_kind: "user",
        subject_id: begun.id,
      });
    });

    it("a repeat completeAsanaTaskNudgeSend call after 'sent' is a no-op — no duplicate audit event", async () => {
      const { organizationId, userId, taskId, collaboration } =
        await seedFixture("complete-sent-repeat");

      const begun = await beginAsanaTaskNudgeSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        taskId,
        body: "Any update on this?",
        idempotencyKey: "complete-sent-repeat:send",
      });

      await completeAsanaTaskNudgeSend(pool, organizationId, userId, begun.id, {
        status: "sent",
        sentAt: new Date(),
        storyGid: "asana-story-2",
      });
      // A second call for the same row, as if the server action retried
      // after a dropped response.
      await completeAsanaTaskNudgeSend(pool, organizationId, userId, begun.id, {
        status: "sent",
        sentAt: new Date(),
        storyGid: "asana-story-2",
      });

      const auditRows = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select id from audit_events where subject_id = $1 and event_type = 'asana_task_nudge.sent'",
            [begun.id],
          );
          return result.rows;
        },
      );

      expect(auditRows).toHaveLength(1);
    });

    it("returns alreadyResolved: 'sent' with the real asanaStoryGid on replay after a successful send", async () => {
      const { organizationId, userId, taskId, collaboration } =
        await seedFixture("begin-sent-replay");

      const begun = await beginAsanaTaskNudgeSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        taskId,
        body: "Any update on this?",
        idempotencyKey: "begin-sent-replay:send",
      });
      await completeAsanaTaskNudgeSend(pool, organizationId, userId, begun.id, {
        status: "sent",
        sentAt: new Date(),
        storyGid: "asana-story-3",
      });

      const replay = await beginAsanaTaskNudgeSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        taskId,
        body: "Any update on this?",
        idempotencyKey: "begin-sent-replay:send",
      });

      expect(replay).toEqual({
        id: begun.id,
        alreadyResolved: "sent",
        asanaStoryGid: "asana-story-3",
      });
    });

    it("completes a send as 'failed' with a real audit event, and resets to 'pending' on retry", async () => {
      const { organizationId, userId, taskId, collaboration } =
        await seedFixture("complete-failed");

      const begun = await beginAsanaTaskNudgeSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        taskId,
        body: "Any update on this?",
        idempotencyKey: "complete-failed:send",
      });

      await completeAsanaTaskNudgeSend(pool, organizationId, userId, begun.id, {
        status: "failed",
        failureReason: "Asana rate limited",
      });

      const failedRow = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select status, failure_reason from asana_task_nudges where id = $1",
            [begun.id],
          );
          return result.rows[0];
        },
      );
      expect(failedRow).toEqual({
        status: "failed",
        failure_reason: "Asana rate limited",
      });

      // Retry: the same idempotency key resets the row to 'pending' rather
      // than leaving it stuck 'failed' forever.
      const retried = await beginAsanaTaskNudgeSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        taskId,
        body: "Any update on this?",
        idempotencyKey: "complete-failed:send",
      });

      expect(retried.id).toBe(begun.id);
      expect(retried.alreadyResolved).toBeNull();

      await completeAsanaTaskNudgeSend(
        pool,
        organizationId,
        userId,
        retried.id,
        {
          status: "sent",
          sentAt: new Date(),
          storyGid: "asana-story-4",
        },
      );

      const [finalRow, auditRows] = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const nudgeResult = await client.query(
            "select status from asana_task_nudges where id = $1",
            [begun.id],
          );
          const auditResult = await client.query(
            "select event_type from audit_events where subject_id = $1 order by occurred_at asc",
            [begun.id],
          );
          return [nudgeResult.rows[0], auditResult.rows];
        },
      );

      expect(finalRow.status).toBe("sent");
      expect(
        auditRows.map((row: { event_type: string }) => row.event_type),
      ).toEqual(["asana_task_nudge.failed", "asana_task_nudge.sent"]);
    });

    it("lets only one of two concurrent retries of the same failed idempotency key proceed to send — never both", async () => {
      const { organizationId, userId, taskId, collaboration } =
        await seedFixture("concurrent-retry");

      const begun = await beginAsanaTaskNudgeSend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        taskId,
        body: "Any update on this?",
        idempotencyKey: "concurrent-retry:send",
      });
      await completeAsanaTaskNudgeSend(pool, organizationId, userId, begun.id, {
        status: "failed",
        failureReason: "Asana rate limited",
      });

      // Two concurrent callers both retry the same failed idempotency key —
      // e.g. a UI double-click and a background retry, or two server
      // instances racing the same approval. Regression coverage for the
      // same real bug fixed in customer-email-replies.ts:
      // beginAsanaTaskNudgeSend's "failed -> pending" reset UPDATE is
      // guarded by `and status = 'failed'` and re-checked via RETURNING, so
      // both concurrent SELECTs reading 'failed' before either UPDATE
      // commits cannot both return alreadyResolved: null — the race's loser
      // must see alreadyResolved: 'pending', not null.
      const [first, second] = await Promise.all([
        beginAsanaTaskNudgeSend(pool, organizationId, {
          userId,
          agentCollaborationId: collaboration.id,
          taskId,
          body: "Any update on this?",
          idempotencyKey: "concurrent-retry:send",
        }),
        beginAsanaTaskNudgeSend(pool, organizationId, {
          userId,
          agentCollaborationId: collaboration.id,
          taskId,
          body: "Any update on this?",
          idempotencyKey: "concurrent-retry:send",
        }),
      ]);

      expect(first.id).toBe(begun.id);
      expect(second.id).toBe(begun.id);

      const resolvedValues = [first.alreadyResolved, second.alreadyResolved];
      // Exactly one caller must be told it's safe to send (null); the other
      // must be told a send is already in flight (pending) — never both
      // null, which would mean two real Asana calls for one approval.
      expect(resolvedValues.filter((value) => value === null)).toHaveLength(1);
      expect(
        resolvedValues.filter((value) => value === "pending"),
      ).toHaveLength(1);
    });

    it("does not let one organization begin a send against another's collaboration/task", async () => {
      const orgA = await seedFixture("cross-tenant-a");
      const orgB = await seedFixture("cross-tenant-b");

      await expect(
        beginAsanaTaskNudgeSend(pool, orgA.organizationId, {
          userId: orgA.userId,
          agentCollaborationId: orgB.collaboration.id,
          taskId: orgB.taskId,
          body: "Any update on this?",
          idempotencyKey: "cross-tenant-attempt",
        }),
      ).rejects.toThrow();
    });
  },
);
