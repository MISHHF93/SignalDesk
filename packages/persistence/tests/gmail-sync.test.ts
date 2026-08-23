import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { ingestGmailMessage } from "../src/gmail-sync";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedOrganization,
  seedSyncJob,
} from "./support";

function fixtureInput(
  syncJobId: string,
  overrides: Partial<Parameters<typeof ingestGmailMessage>[3]> = {},
) {
  return {
    externalRecordId: `msg-${randomUUID()}`,
    sourceVersion: "1755432000000",
    rawPayloadSha256: "a".repeat(64),
    rawPayloadByteLength: 512,
    observedAt: new Date(),
    externalThreadId: `thread-${randomUUID()}`,
    direction: "inbound" as const,
    counterpartyEmail: "jane@clientco.com",
    counterpartyName: "Jane Client",
    subject: "Re: Q3 proposal",
    snippet: "Following up on the proposal...",
    bodyPreview: "Hi, following up on the proposal we discussed last week.",
    bodyTruncated: false,
    occurredAt: new Date("2026-08-17T12:00:00.000Z"),
    retainUntil: new Date("2027-02-17T12:00:00.000Z"),
    syncJobId,
    ...overrides,
  };
}

// Exercises ingestGmailMessage against the live database: a real
// source_records → messages write, idempotency on repeat ingestion of the
// same source_version, real leads.contact_email resolution, and that
// messages carry the same tenant-isolation guarantees every other
// normalized entity does.
describe.skipIf(!process.env.DATABASE_URL)("gmail sync (live database)", () => {
  let pool: DatabasePool;

  beforeAll(() => {
    pool = getTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("writes a real source_record and a matching message", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "gmail",
    });
    const job = await seedSyncJob(
      pool,
      org.id,
      integration.id,
      "gmail",
      "message",
    );
    const input = fixtureInput(job.id);

    const result = await ingestGmailMessage(
      pool,
      org.id,
      integration.id,
      input,
    );

    expect(result.inserted).toBe(true);
    expect(result.sourceRecordId).not.toBeNull();
    expect(result.messageId).not.toBeNull();

    const [sourceRecordRow, messageRow] = await withTenantContext(
      pool,
      org.id,
      async (client) => {
        const sourceRecordResult = await client.query(
          "select source_system, source_object_type, external_record_id from source_records where id = $1",
          [result.sourceRecordId],
        );
        const messageResult = await client.query(
          `select direction, counterparty_email, counterparty_name, subject,
                  snippet, body_preview, body_truncated, lead_id
           from messages where id = $1`,
          [result.messageId],
        );
        return [sourceRecordResult.rows[0], messageResult.rows[0]];
      },
    );

    expect(sourceRecordRow).toEqual({
      source_system: "gmail",
      source_object_type: "message",
      external_record_id: input.externalRecordId,
    });
    expect(messageRow).toEqual({
      direction: "inbound",
      counterparty_email: input.counterpartyEmail,
      counterparty_name: input.counterpartyName,
      subject: input.subject,
      snippet: input.snippet,
      body_preview: input.bodyPreview,
      body_truncated: false,
      lead_id: null,
    });
  });

  it("is idempotent for the same external record at the same source version", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "gmail",
    });
    const job = await seedSyncJob(
      pool,
      org.id,
      integration.id,
      "gmail",
      "message",
    );
    const input = fixtureInput(job.id);

    const first = await ingestGmailMessage(pool, org.id, integration.id, input);
    const second = await ingestGmailMessage(
      pool,
      org.id,
      integration.id,
      input,
    );

    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.sourceRecordId).toBeNull();
  });

  it("resolves lead_id when counterpartyEmail exactly matches a real lead's contact_email", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "gmail",
    });
    const hubspotIntegration = await seedIntegration(pool, org.id, {
      sourceSystem: "hubspot",
    });
    const leadSyncJob = await seedSyncJob(
      pool,
      org.id,
      hubspotIntegration.id,
      "hubspot",
      "lead",
    );
    const email = `jane-${randomUUID()}@clientco.com`;

    const leadId = await withTenantContext(pool, org.id, async (client) => {
      const sourceRecordResult = await client.query<{ id: string }>(
        `insert into source_records (
           id, organization_id, integration_id, source_system, source_object_type,
           external_record_id, source_version, source_schema_version,
           idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
           sync_job_id
         ) values ($1, $2, $3, 'hubspot', 'deal', $4, 'v1', 1, $5, now(), $6, 0, $7)
         returning id`,
        [
          randomUUID(),
          org.id,
          hubspotIntegration.id,
          `deal-${randomUUID()}`,
          `idem-${randomUUID()}`,
          "b".repeat(64),
          leadSyncJob.id,
        ],
      );
      const sourceRecordId = sourceRecordResult.rows[0]!.id;
      const id = randomUUID();

      await client.query(
        `insert into leads (
           id, organization_id, source_record_id, contact_name, company_name,
           stage, expected_response_hours, source_created_at,
           canonical_schema_version, normalization_version, contact_email
         ) values ($1, $2, $3, 'Jane Client', 'Client Co', 'new', 24, now(), 1, 'hubspot-deal-v1', $4)`,
        [id, org.id, sourceRecordId, email],
      );

      return id;
    });

    const job = await seedSyncJob(
      pool,
      org.id,
      integration.id,
      "gmail",
      "message",
    );
    const result = await ingestGmailMessage(
      pool,
      org.id,
      integration.id,
      fixtureInput(job.id, { counterpartyEmail: email.toUpperCase() }),
    );

    const [messageRow] = await withTenantContext(
      pool,
      org.id,
      async (client) => {
        const messageResult = await client.query(
          "select lead_id from messages where id = $1",
          [result.messageId],
        );
        return messageResult.rows;
      },
    );

    expect(messageRow?.lead_id).toBe(leadId);
  });

  it("leaves lead_id null when counterpartyEmail matches no real lead", async () => {
    const org = await seedOrganization(pool);
    const integration = await seedIntegration(pool, org.id, {
      sourceSystem: "gmail",
    });
    const job = await seedSyncJob(
      pool,
      org.id,
      integration.id,
      "gmail",
      "message",
    );

    const result = await ingestGmailMessage(
      pool,
      org.id,
      integration.id,
      fixtureInput(job.id, { counterpartyEmail: "nobody@nowhere.example" }),
    );

    const [messageRow] = await withTenantContext(
      pool,
      org.id,
      async (client) => {
        const messageResult = await client.query(
          "select lead_id from messages where id = $1",
          [result.messageId],
        );
        return messageResult.rows;
      },
    );

    expect(messageRow?.lead_id).toBeNull();
  });

  it("cannot see another organization's ingested messages", async () => {
    const orgA = await seedOrganization(pool);
    const orgB = await seedOrganization(pool);
    const integrationA = await seedIntegration(pool, orgA.id, {
      sourceSystem: "gmail",
    });
    const job = await seedSyncJob(
      pool,
      orgA.id,
      integrationA.id,
      "gmail",
      "message",
    );

    const result = await ingestGmailMessage(
      pool,
      orgA.id,
      integrationA.id,
      fixtureInput(job.id),
    );

    const rows = await withTenantContext(pool, orgB.id, async (client) => {
      const messageResult = await client.query(
        "select id from messages where id = $1",
        [result.messageId],
      );
      return messageResult.rows;
    });

    expect(rows).toHaveLength(0);
  });
});
