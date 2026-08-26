import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startAgentCollaboration } from "../src/agent-collaborations";
import type { DatabasePool } from "../src/client";
import { beginCustomerEmailReplySend } from "../src/customer-email-replies";
import { ingestGmailMessage } from "../src/gmail-sync";
import { ingestQuickBooksInvoice } from "../src/invoices";
import {
  anonymizeOrganization,
  exportOrganizationData,
} from "../src/organization-lifecycle";
import { withTenantContext } from "../src/tenant-context";
import { ingestZendeskTicket } from "../src/zendesk-sync";
import {
  getTestPool,
  seedIntegration,
  seedMembership,
  seedMessage,
  seedOrganization,
  seedSourceRecord,
  seedSyncJob,
} from "./support";

async function seedLead(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  overrides: {
    contactName?: string;
    companyName?: string | null;
    sourceSystem?: string;
  } = {},
): Promise<{ id: string }> {
  const sourceRecord = await seedSourceRecord(
    pool,
    organizationId,
    integrationId,
    overrides.sourceSystem ?? "hubspot",
  );
  const id = randomUUID();

  await withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      `insert into leads (
         id, organization_id, source_record_id, contact_name, company_name,
         stage, expected_response_hours, source_created_at,
         canonical_schema_version, normalization_version
       ) values ($1, $2, $3, $4, $5, 'new', 24, now(), 1, 'test-v1')`,
      [
        id,
        organizationId,
        sourceRecord.id,
        overrides.contactName ?? "Real Person",
        overrides.companyName ?? "Real Company",
      ],
    );
  });

  return { id };
}

// All three reads go through withTenantContext -- users/organizations/leads
// are RLS-protected (users_tenant_select requires a membership in the
// querying tenant context; a bare pool.query with no context set returns
// zero rows, not an error, which would otherwise silently break these
// assertions rather than failing them loudly.
async function getUserIdentity(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
) {
  const result = await withTenantContext(pool, organizationId, (client) =>
    client.query<{ display_name: string; primary_email: string | null }>(
      `select display_name, primary_email from users where id = $1`,
      [userId],
    ),
  );
  return result.rows[0];
}

async function getOrganizationLifecycleRow(
  pool: DatabasePool,
  organizationId: string,
) {
  const result = await withTenantContext(pool, organizationId, (client) =>
    client.query<{
      display_name: string;
      slug: string;
      deactivated_at: Date | null;
    }>(
      `select display_name, slug, deactivated_at from organizations where id = $1`,
      [organizationId],
    ),
  );
  return result.rows[0];
}

async function getLeadIdentity(
  pool: DatabasePool,
  organizationId: string,
  id: string,
) {
  const result = await withTenantContext(pool, organizationId, (client) =>
    client.query<{ contact_name: string; company_name: string | null }>(
      `select contact_name, company_name from leads where id = $1`,
      [id],
    ),
  );
  return result.rows[0];
}

describe.skipIf(!process.env.DATABASE_URL)(
  "exportOrganizationData (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("assembles a real export from real data across entities", async () => {
      const { organizationId } = await seedMembership(pool);
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "quickbooks",
      });
      const job = await seedSyncJob(
        pool,
        organizationId,
        integration.id,
        "quickbooks",
        "invoice",
      );
      await ingestQuickBooksInvoice(pool, organizationId, integration.id, {
        externalRecordId: `inv-${randomUUID()}`,
        sourceVersion: "v1",
        rawPayloadSha256: "c".repeat(64),
        rawPayloadByteLength: 10,
        observedAt: new Date(),
        customerName: "Acme Robotics",
        amountCents: 50_00,
        currency: "USD",
        dueAt: new Date(),
        status: "open",
        syncJobId: job.id,
      });

      await seedLead(pool, organizationId, integration.id, {
        sourceSystem: "quickbooks",
      });

      const exportData = await exportOrganizationData(pool, organizationId);

      expect(exportData.organization.id).toBe(organizationId);
      expect(exportData.invoices).toHaveLength(1);
      expect(exportData.invoices[0]?.customerName).toBe("Acme Robotics");
      expect(exportData.leads.length).toBeGreaterThanOrEqual(1);
      expect(exportData.subscription).toBeNull();
      expect(exportData.exportedAt).toBeInstanceOf(Date);
    });

    it("returns empty arrays, not an error, for an organization with no data", async () => {
      const { organizationId } = await seedMembership(pool);

      const exportData = await exportOrganizationData(pool, organizationId);

      expect(exportData.leads).toEqual([]);
      expect(exportData.invoices).toEqual([]);
      expect(exportData.tasks).toEqual([]);
      expect(exportData.messages).toEqual([]);
      expect(exportData.supportTickets).toEqual([]);
      expect(exportData.artifacts).toEqual([]);
    });

    it("includes real messages and support tickets", async () => {
      const { organizationId } = await seedMembership(pool);
      const gmailIntegration = await seedIntegration(pool, organizationId, {
        sourceSystem: "gmail",
      });
      const gmailJob = await seedSyncJob(
        pool,
        organizationId,
        gmailIntegration.id,
        "gmail",
        "message",
      );
      await ingestGmailMessage(pool, organizationId, gmailIntegration.id, {
        externalRecordId: `msg-${randomUUID()}`,
        sourceVersion: "1755432000000",
        rawPayloadSha256: "a".repeat(64),
        rawPayloadByteLength: 512,
        observedAt: new Date(),
        externalThreadId: `thread-${randomUUID()}`,
        direction: "inbound",
        counterpartyEmail: "jane@clientco.com",
        counterpartyName: "Jane Client",
        subject: "Re: Q3 proposal",
        snippet: null,
        bodyPreview: "Real body text that must never appear in the export.",
        bodyTruncated: false,
        occurredAt: new Date(),
        retainUntil: null,
        syncJobId: gmailJob.id,
      });

      const zendeskIntegration = await seedIntegration(pool, organizationId, {
        sourceSystem: "zendesk",
      });
      const zendeskJob = await seedSyncJob(
        pool,
        organizationId,
        zendeskIntegration.id,
        "zendesk",
        "support_ticket",
      );
      await ingestZendeskTicket(pool, organizationId, zendeskIntegration.id, {
        externalRecordId: `ticket-${randomUUID()}`,
        sourceVersion: "2026-08-18T13:56:00.000Z",
        rawPayloadSha256: "b".repeat(64),
        rawPayloadByteLength: 512,
        observedAt: new Date(),
        subject: "Cannot log in",
        status: "open",
        priority: "high",
        requesterName: "Jane Client",
        assigneeName: "Jamie Rivera",
        dueAt: null,
        syncJobId: zendeskJob.id,
        lastActivityAt: new Date(),
      });

      const exportData = await exportOrganizationData(pool, organizationId);

      expect(exportData.messages).toHaveLength(1);
      expect(exportData.messages[0]?.subject).toBe("Re: Q3 proposal");
      expect(exportData.messages[0]).not.toHaveProperty("bodyPreview");
      expect(exportData.supportTickets).toHaveLength(1);
      expect(exportData.supportTickets[0]?.subject).toBe("Cannot log in");
    });
  },
);

describe.skipIf(!process.env.DATABASE_URL)(
  "anonymizeOrganization (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("scrubs organization and user PII and marks the org deactivated", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      await anonymizeOrganization(pool, organizationId);

      const org = await getOrganizationLifecycleRow(pool, organizationId);
      expect(org?.display_name).toBe("[deleted organization]");
      // slug is deliberately untouched — organizations_immutable_identity
      // (0003) protects it as a stable identity key, not PII.
      expect(org?.deactivated_at).not.toBeNull();

      const user = await getUserIdentity(pool, organizationId, userId);
      expect(user?.display_name).toBe("[deleted user]");
      expect(user?.primary_email).toBeNull();
    });

    it("scrubs lead/invoice/task PII but preserves the rows and their provenance link", async () => {
      const { organizationId } = await seedMembership(pool);
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "hubspot",
      });
      const lead = await seedLead(pool, organizationId, integration.id, {
        contactName: "Priya Nair",
        companyName: "Acme Robotics",
      });

      await anonymizeOrganization(pool, organizationId);

      const scrubbedLead = await getLeadIdentity(pool, organizationId, lead.id);
      expect(scrubbedLead?.contact_name).toBe("[deleted]");
      expect(scrubbedLead?.company_name).toBeNull();

      // The row itself, and its link back to source_records, still exists —
      // anonymization scrubs PII, it does not delete provenance.
      const rowCount = await withTenantContext(pool, organizationId, (client) =>
        client.query<{ count: string }>(
          `select count(*) as count from leads where id = $1`,
          [lead.id],
        ),
      );
      expect(Number(rowCount.rows[0]?.count)).toBe(1);
    });

    it("does not anonymize a user who belongs to another, still-active organization", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const { id: secondOrgId } = await seedOrganization(pool);

      // A second membership for the same user in a different organization —
      // simulating the not-yet-real "user belongs to more than one org"
      // case this guard exists for.
      await withTenantContext(pool, secondOrgId, async (client) => {
        await client.query(
          `insert into memberships (id, organization_id, user_id, role, status)
           values ($1, $2, $3, 'owner', 'active')`,
          [randomUUID(), secondOrgId, userId],
        );
      });

      await anonymizeOrganization(pool, organizationId);

      const user = await getUserIdentity(pool, secondOrgId, userId);
      expect(user?.display_name).not.toBe("[deleted user]");
      expect(user?.primary_email).not.toBeNull();
    });

    it("stops a deactivated organization from resolving to a valid session", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const identity = await withTenantContext(pool, organizationId, (client) =>
        client.query<{
          identity_provider: string;
          identity_provider_subject: string;
        }>(
          `select identity_provider, identity_provider_subject from users where id = $1`,
          [userId],
        ),
      );
      const row = identity.rows[0];

      if (!row) {
        throw new Error("expected the seeded user to exist");
      }

      const { identity_provider, identity_provider_subject } = row;

      const before = await pool.query(
        `select * from public.resolve_memberships_for_identity($1, $2)`,
        [identity_provider, identity_provider_subject],
      );
      expect(before.rows).toHaveLength(1);

      await anonymizeOrganization(pool, organizationId);

      const after = await pool.query(
        `select * from public.resolve_memberships_for_identity($1, $2)`,
        [identity_provider, identity_provider_subject],
      );
      expect(after.rows).toHaveLength(0);
    });

    it("scrubs message and support_ticket PII but preserves the rows and their provenance link", async () => {
      const { organizationId } = await seedMembership(pool);
      const gmailIntegration = await seedIntegration(pool, organizationId, {
        sourceSystem: "gmail",
      });
      const gmailJob = await seedSyncJob(
        pool,
        organizationId,
        gmailIntegration.id,
        "gmail",
        "message",
      );
      const messageResult = await ingestGmailMessage(
        pool,
        organizationId,
        gmailIntegration.id,
        {
          externalRecordId: `msg-${randomUUID()}`,
          sourceVersion: "1755432000000",
          rawPayloadSha256: "a".repeat(64),
          rawPayloadByteLength: 512,
          observedAt: new Date(),
          externalThreadId: `thread-${randomUUID()}`,
          direction: "inbound",
          counterpartyEmail: "jane@clientco.com",
          counterpartyName: "Jane Client",
          subject: "Re: Q3 proposal",
          snippet: "Following up on the proposal...",
          bodyPreview: null,
          bodyTruncated: false,
          occurredAt: new Date(),
          retainUntil: null,
          syncJobId: gmailJob.id,
        },
      );

      const zendeskIntegration = await seedIntegration(pool, organizationId, {
        sourceSystem: "zendesk",
      });
      const zendeskJob = await seedSyncJob(
        pool,
        organizationId,
        zendeskIntegration.id,
        "zendesk",
        "support_ticket",
      );
      const ticketResult = await ingestZendeskTicket(
        pool,
        organizationId,
        zendeskIntegration.id,
        {
          externalRecordId: `ticket-${randomUUID()}`,
          sourceVersion: "2026-08-18T13:56:00.000Z",
          rawPayloadSha256: "b".repeat(64),
          rawPayloadByteLength: 512,
          observedAt: new Date(),
          subject: "Cannot log in",
          status: "open",
          priority: "high",
          requesterName: "Jane Client",
          assigneeName: "Jamie Rivera",
          syncJobId: zendeskJob.id,
          dueAt: null,
          lastActivityAt: new Date(),
        },
      );

      await anonymizeOrganization(pool, organizationId);

      const [messageRow] = await withTenantContext(
        pool,
        organizationId,
        (client) =>
          client
            .query<{
              counterparty_name: string | null;
              counterparty_email: string;
            }>(
              `select counterparty_name, counterparty_email from messages where id = $1`,
              [messageResult.messageId],
            )
            .then((result) => result.rows),
      );
      expect(messageRow?.counterparty_name).toBeNull();
      expect(messageRow?.counterparty_email).toBe("deleted@deleted.invalid");

      const [ticketRow] = await withTenantContext(
        pool,
        organizationId,
        (client) =>
          client
            .query<{
              requester_name: string | null;
              assignee_name: string | null;
            }>(
              `select requester_name, assignee_name from support_tickets where id = $1`,
              [ticketResult.ticketId],
            )
            .then((result) => result.rows),
      );
      expect(ticketRow?.requester_name).toBeNull();
      expect(ticketRow?.assignee_name).toBeNull();

      // The rows themselves, and their link back to source_records, still
      // exist — anonymization scrubs PII, it does not delete provenance.
      const messageCount = await withTenantContext(
        pool,
        organizationId,
        (client) =>
          client.query<{ count: string }>(
            `select count(*) as count from messages where id = $1`,
            [messageResult.messageId],
          ),
      );
      expect(Number(messageCount.rows[0]?.count)).toBe(1);
    });

    it("regression: real gap found by review — scrubs customer_email_replies.to_email but preserves the row and its provenance link", async () => {
      // anonymize_organization predates customer_email_replies (0059) —
      // a customer requesting "erase my data" would still have a real
      // recipient email address sitting in the database afterward.
      const { organizationId, userId } = await seedMembership(pool);
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "gmail",
      });
      const sourceRecord = await seedSourceRecord(
        pool,
        organizationId,
        integration.id,
        integration.sourceSystem,
      );
      const message = await seedMessage(pool, organizationId, sourceRecord.id);
      const idempotencyKey = `anonymize-email-reply-${randomUUID()}`;
      const collaboration = await startAgentCollaboration(
        pool,
        organizationId,
        {
          userId,
          pattern: "single_specialist",
          objective: "Draft a reply to this message.",
          correlationId: `${idempotencyKey}:collaboration`,
          idempotencyKey: `${idempotencyKey}:collaboration`,
          messageId: message.id,
        },
      );
      const send = await beginCustomerEmailReplySend(pool, organizationId, {
        userId,
        agentCollaborationId: collaboration.id,
        messageId: message.id,
        toEmail: "jane@clientco.com",
        subject: "Re: Question about my order",
        body: "Your order ships tomorrow.",
        idempotencyKey: `${idempotencyKey}:send`,
      });

      await anonymizeOrganization(pool, organizationId);

      const [replyRow] = await withTenantContext(
        pool,
        organizationId,
        (client) =>
          client
            .query<{ to_email: string; subject: string }>(
              `select to_email, subject from customer_email_replies where id = $1`,
              [send.id],
            )
            .then((result) => result.rows),
      );
      expect(replyRow?.to_email).toBe("deleted@deleted.invalid");
      // subject (free-text) stays untouched — same disclosed limitation
      // as messages/support_tickets' own free-text fields.
      expect(replyRow?.subject).toBe("Re: Question about my order");
    });

    it("leaves audit events and source records untouched", async () => {
      const { organizationId } = await seedMembership(pool);
      const integration = await seedIntegration(pool, organizationId, {
        sourceSystem: "hubspot",
      });
      const sourceRecord = await seedSourceRecord(
        pool,
        organizationId,
        integration.id,
        "hubspot",
      );

      await anonymizeOrganization(pool, organizationId);

      const sourceRecordRow = await withTenantContext(
        pool,
        organizationId,
        (client) =>
          client.query<{ count: string }>(
            `select count(*) as count from source_records where id = $1`,
            [sourceRecord.id],
          ),
      );
      expect(Number(sourceRecordRow.rows[0]?.count)).toBe(1);
    });
  },
);
