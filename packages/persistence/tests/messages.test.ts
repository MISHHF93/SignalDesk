import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { listUnansweredExternalMessages } from "../src/messages";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedOrganization,
  seedSyncJob,
} from "./support";

async function seedMessage(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  overrides: {
    externalThreadId?: string;
    direction?: "inbound" | "outbound";
    occurredAt?: Date;
    counterpartyEmail?: string;
    subject?: string;
  } = {},
): Promise<{ id: string }> {
  const job = await seedSyncJob(
    pool,
    organizationId,
    integrationId,
    "gmail",
    "message",
  );

  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
         sync_job_id
       ) values ($1, $2, $3, 'gmail', 'message', $4, $5, 1, $6, now(), $7, 0, $8)
       returning id`,
      [
        randomUUID(),
        organizationId,
        integrationId,
        `msg-${randomUUID()}`,
        `${(overrides.occurredAt ?? new Date()).getTime()}`,
        `idem-${randomUUID()}`,
        "c".repeat(64),
        job.id,
      ],
    );
    const sourceRecordId = sourceRecordResult.rows[0]!.id;
    const id = randomUUID();

    await client.query(
      `insert into messages (
         id, organization_id, source_record_id, external_thread_id, direction,
         counterparty_email, subject, occurred_at,
         canonical_schema_version, normalization_version
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, 1, 'gmail-message-v1')`,
      [
        id,
        organizationId,
        sourceRecordId,
        overrides.externalThreadId ?? `thread-${randomUUID()}`,
        overrides.direction ?? "inbound",
        overrides.counterpartyEmail ?? "jane@clientco.com",
        overrides.subject ?? "Re: Q3 proposal",
        overrides.occurredAt ?? new Date(),
      ],
    );

    return { id };
  });
}

describe.skipIf(!process.env.DATABASE_URL)(
  "listUnansweredExternalMessages (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("surfaces a thread whose latest message is inbound with no reply", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "gmail",
      });

      const message = await seedMessage(pool, org.id, integration.id, {
        direction: "inbound",
      });

      const results = await listUnansweredExternalMessages(pool, org.id);

      expect(results.map((m) => m.id)).toContain(message.id);
    });

    it("does not surface a thread whose latest message is an outbound reply", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "gmail",
      });
      const threadId = `thread-${randomUUID()}`;

      await seedMessage(pool, org.id, integration.id, {
        externalThreadId: threadId,
        direction: "inbound",
        occurredAt: new Date("2026-08-17T12:00:00.000Z"),
      });
      const reply = await seedMessage(pool, org.id, integration.id, {
        externalThreadId: threadId,
        direction: "outbound",
        occurredAt: new Date("2026-08-17T15:00:00.000Z"),
      });

      const results = await listUnansweredExternalMessages(pool, org.id);
      const threadIds = results.map((m) => m.id);

      expect(threadIds).not.toContain(reply.id);
      expect(results.every((m) => m.externalThreadId !== threadId)).toBe(true);
    });

    it("resolves to only the latest message per thread, not every inbound message", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "gmail",
      });
      const threadId = `thread-${randomUUID()}`;

      const older = await seedMessage(pool, org.id, integration.id, {
        externalThreadId: threadId,
        direction: "inbound",
        occurredAt: new Date("2026-08-15T12:00:00.000Z"),
      });
      const newer = await seedMessage(pool, org.id, integration.id, {
        externalThreadId: threadId,
        direction: "inbound",
        occurredAt: new Date("2026-08-17T12:00:00.000Z"),
      });

      const results = await listUnansweredExternalMessages(pool, org.id);
      const threadResults = results.filter(
        (m) => m.externalThreadId === threadId,
      );

      expect(threadResults).toHaveLength(1);
      expect(threadResults[0]?.id).toBe(newer.id);
      expect(threadResults.map((m) => m.id)).not.toContain(older.id);
    });

    it("excludes messages from a disconnected integration", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "gmail",
      });

      const message = await seedMessage(pool, org.id, integration.id, {
        direction: "inbound",
      });

      await withTenantContext(pool, org.id, async (client) => {
        await client.query(
          "update integrations set status = 'disconnected' where id = $1",
          [integration.id],
        );
      });

      const results = await listUnansweredExternalMessages(pool, org.id);

      expect(results.map((m) => m.id)).not.toContain(message.id);
    });

    it("cannot see another organization's unanswered messages", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationA = await seedIntegration(pool, orgA.id, {
        sourceSystem: "gmail",
      });

      await seedMessage(pool, orgA.id, integrationA.id, {
        direction: "inbound",
      });

      const resultsForB = await listUnansweredExternalMessages(pool, orgB.id);

      expect(resultsForB).toHaveLength(0);
    });

    it("never exposes body preview text on the returned Message objects", async () => {
      const org = await seedOrganization(pool);
      const integration = await seedIntegration(pool, org.id, {
        sourceSystem: "gmail",
      });

      await seedMessage(pool, org.id, integration.id, { direction: "inbound" });

      const results = await listUnansweredExternalMessages(pool, org.id);

      expect(results.length).toBeGreaterThan(0);
      for (const message of results) {
        expect(message).not.toHaveProperty("bodyPreview");
      }
    });
  },
);
