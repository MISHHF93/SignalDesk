import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  getMessageDraftContext,
  getMessageSendContext,
} from "../src/message-reply-context";
import {
  getTestPool,
  seedIntegration,
  seedMembership,
  seedMessage,
  seedSourceRecord,
} from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "message reply context (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    describe("getMessageDraftContext", () => {
      it("returns the real body_preview as inboundBodyText when present", async () => {
        const { organizationId } = await seedMembership(pool);
        const integration = await seedIntegration(pool, organizationId);
        const sourceRecord = await seedSourceRecord(
          pool,
          organizationId,
          integration.id,
          integration.sourceSystem,
        );
        const message = await seedMessage(
          pool,
          organizationId,
          sourceRecord.id,
          {
            subject: "Question about my order",
            counterpartyName: "Jane Client",
            counterpartyEmail: "jane@example.test",
            bodyPreview: "When will my order ship? It has been a week.",
            bodyTruncated: false,
          },
        );

        const context = await getMessageDraftContext(
          pool,
          organizationId,
          message.id,
        );

        expect(context).toEqual({
          messageId: message.id,
          subject: "Question about my order",
          counterpartyName: "Jane Client",
          counterpartyEmail: "jane@example.test",
          inboundBodyText: "When will my order ship? It has been a week.",
          bodyTruncated: false,
        });
      });

      it("falls back to the snippet when body_preview is null", async () => {
        const { organizationId } = await seedMembership(pool);
        const integration = await seedIntegration(pool, organizationId);
        const sourceRecord = await seedSourceRecord(
          pool,
          organizationId,
          integration.id,
          integration.sourceSystem,
        );
        const message = await seedMessage(
          pool,
          organizationId,
          sourceRecord.id,
          {
            snippet: "A short preview only",
            bodyPreview: null,
            bodyTruncated: false,
          },
        );

        const context = await getMessageDraftContext(
          pool,
          organizationId,
          message.id,
        );

        expect(context?.inboundBodyText).toBe("A short preview only");
        // A fallback snippet is never marked truncated on the body's own
        // truncation flag alone.
        expect(context?.bodyTruncated).toBe(false);
      });

      it("reports bodyTruncated only when a real body_preview was itself truncated", async () => {
        const { organizationId } = await seedMembership(pool);
        const integration = await seedIntegration(pool, organizationId);
        const sourceRecord = await seedSourceRecord(
          pool,
          organizationId,
          integration.id,
          integration.sourceSystem,
        );
        const message = await seedMessage(
          pool,
          organizationId,
          sourceRecord.id,
          {
            bodyPreview: "A very long message cut short",
            bodyTruncated: true,
          },
        );

        const context = await getMessageDraftContext(
          pool,
          organizationId,
          message.id,
        );

        expect(context?.bodyTruncated).toBe(true);
      });

      it("returns null for a message that does not exist", async () => {
        const { organizationId } = await seedMembership(pool);

        const context = await getMessageDraftContext(
          pool,
          organizationId,
          "66666666-6666-4666-8666-666666666666",
        );

        expect(context).toBeNull();
      });

      it("does not return another organization's message", async () => {
        const orgA = await seedMembership(pool);
        const orgB = await seedMembership(pool);
        const integrationB = await seedIntegration(pool, orgB.organizationId);
        const sourceRecordB = await seedSourceRecord(
          pool,
          orgB.organizationId,
          integrationB.id,
          integrationB.sourceSystem,
        );
        const messageB = await seedMessage(
          pool,
          orgB.organizationId,
          sourceRecordB.id,
        );

        const context = await getMessageDraftContext(
          pool,
          orgA.organizationId,
          messageB.id,
        );

        expect(context).toBeNull();
      });
    });

    describe("getMessageSendContext", () => {
      it("returns real send-routing metadata with no body content", async () => {
        const { organizationId } = await seedMembership(pool);
        const integration = await seedIntegration(pool, organizationId, {
          sourceSystem: "gmail",
        });
        const sourceRecord = await seedSourceRecord(
          pool,
          organizationId,
          integration.id,
          integration.sourceSystem,
        );
        const message = await seedMessage(
          pool,
          organizationId,
          sourceRecord.id,
          {
            externalThreadId: "thread-abc",
            counterpartyEmail: "jane@example.test",
            bodyPreview: "Sensitive body content that must never appear here",
          },
        );

        const context = await getMessageSendContext(
          pool,
          organizationId,
          message.id,
        );

        expect(context).toEqual({
          counterpartyEmail: "jane@example.test",
          externalThreadId: "thread-abc",
          integrationId: integration.id,
        });
        expect(JSON.stringify(context)).not.toContain("Sensitive body content");
      });

      it("returns null for a message that does not exist", async () => {
        const { organizationId } = await seedMembership(pool);

        const context = await getMessageSendContext(
          pool,
          organizationId,
          "77777777-7777-4777-8777-777777777777",
        );

        expect(context).toBeNull();
      });
    });
  },
);
