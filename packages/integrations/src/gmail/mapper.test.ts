import { describe, expect, it } from "vitest";

// @signaldesk/schemas is a devDependency only, used here to prove the
// mapper's output actually satisfies the real runtime boundary schema —
// not just this test file's own assumptions about the shape. Mirrors
// hubspot/mapper.test.ts's own precedent exactly.
import { parseSourceMessageRecord } from "@signaldesk/schemas";

import {
  extractMessageBodyPreview,
  mapGmailMessageToSourceMessageRecord,
} from "./mapper";
import type { GmailMessage } from "./client";

const NOW = new Date("2026-08-21T14:00:00.000Z");
const ACCOUNT_EMAIL = "owner@acmeagency.com";

function encodeBody(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64url");
}

function message(overrides: Partial<GmailMessage> = {}): GmailMessage {
  return {
    id: "18d2f0a1b2c3d4e5",
    threadId: "18d2f0a1b2c3d4e0",
    snippet: "Hi, following up on the proposal we discussed last week...",
    internalDate: "1755784800000",
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "Jane Client <jane@clientco.com>" },
        { name: "To", value: "Owner <owner@acmeagency.com>" },
        { name: "Subject", value: "Re: Q3 proposal" },
      ],
      body: { data: encodeBody("Hi, following up on the proposal.") },
    },
    ...overrides,
  };
}

describe("mapGmailMessageToSourceMessageRecord", () => {
  it("maps a real-shaped inbound message into the source message record shape", () => {
    const record = mapGmailMessageToSourceMessageRecord(message(), {
      now: NOW,
      accountEmail: ACCOUNT_EMAIL,
    }) as Record<string, unknown>;

    expect(record).toMatchObject({
      externalThreadId: "18d2f0a1b2c3d4e0",
      direction: "inbound",
      counterpartyEmail: "jane@clientco.com",
      counterpartyName: "Jane Client",
      subject: "Re: Q3 proposal",
      snippet: "Hi, following up on the proposal we discussed last week...",
      source: {
        system: "gmail",
        externalRecordId: "18d2f0a1b2c3d4e5",
        sourceVersion: "1755784800000",
        lastSyncedAt: "2026-08-21T14:00:00.000Z",
      },
    });
    expect(typeof record.id).toBe("string");
    expect(
      (record.source as Record<string, unknown>).recordDigestSha256,
    ).toMatch(/^[a-f0-9]{64}$/);

    // Proves the mapper's output actually satisfies the real runtime
    // boundary schema, not just this test's own assumptions.
    const parsed = parseSourceMessageRecord(record, {
      organizationId: "22222222-2222-4222-8222-222222222222",
      integrationId: "33333333-3333-4333-8333-333333333333",
      leadId: null,
    });
    expect(parsed.direction).toBe("inbound");
  });

  it("maps an outbound reply (From is the connected account) with the recipient as counterparty", () => {
    const record = mapGmailMessageToSourceMessageRecord(
      message({
        payload: {
          ...message().payload,
          headers: [
            { name: "From", value: "Owner <owner@acmeagency.com>" },
            { name: "To", value: "Jane Client <jane@clientco.com>" },
            { name: "Subject", value: "Re: Q3 proposal" },
          ],
        },
      }),
      { now: NOW, accountEmail: ACCOUNT_EMAIL },
    ) as Record<string, unknown>;

    expect(record.direction).toBe("outbound");
    expect(record.counterpartyEmail).toBe("jane@clientco.com");
  });

  it("returns null for a purely internal message (every participant shares the account's domain)", () => {
    const record = mapGmailMessageToSourceMessageRecord(
      message({
        payload: {
          ...message().payload,
          headers: [
            { name: "From", value: "Owner <owner@acmeagency.com>" },
            { name: "To", value: "Teammate <teammate@acmeagency.com>" },
            { name: "Subject", value: "Internal note" },
          ],
        },
      }),
      { now: NOW, accountEmail: ACCOUNT_EMAIL },
    );

    expect(record).toBeNull();
  });

  it("returns null when no usable From/To/Cc address exists at all", () => {
    const record = mapGmailMessageToSourceMessageRecord(
      message({ payload: { ...message().payload, headers: [] } }),
      { now: NOW, accountEmail: ACCOUNT_EMAIL },
    );

    expect(record).toBeNull();
  });

  it("falls back to a placeholder subject when Subject is missing", () => {
    const record = mapGmailMessageToSourceMessageRecord(
      message({
        payload: {
          ...message().payload,
          headers: [
            { name: "From", value: "jane@clientco.com" },
            { name: "To", value: "owner@acmeagency.com" },
          ],
        },
      }),
      { now: NOW, accountEmail: ACCOUNT_EMAIL },
    ) as Record<string, unknown>;

    expect(record.subject).toBe("(no subject)");
    expect(record.counterpartyName).toBeNull();
  });

  it("keeps a message with mixed internal and external recipients (Cc includes an external address)", () => {
    const record = mapGmailMessageToSourceMessageRecord(
      message({
        payload: {
          ...message().payload,
          headers: [
            { name: "From", value: "Owner <owner@acmeagency.com>" },
            { name: "To", value: "Teammate <teammate@acmeagency.com>" },
            { name: "Cc", value: "Jane Client <jane@clientco.com>" },
            { name: "Subject", value: "Looping in the client" },
          ],
        },
      }),
      { now: NOW, accountEmail: ACCOUNT_EMAIL },
    );

    expect(record).not.toBeNull();
  });
});

describe("extractMessageBodyPreview", () => {
  it("extracts and trims a real text/plain body", () => {
    const result = extractMessageBodyPreview(message());

    expect(result).toEqual({
      bodyPreview: "Hi, following up on the proposal.",
      bodyTruncated: false,
    });
  });

  it("falls back to a tag-stripped text/html part when no text/plain part exists", () => {
    const result = extractMessageBodyPreview(
      message({
        payload: {
          mimeType: "multipart/alternative",
          parts: [
            {
              mimeType: "text/html",
              body: { data: encodeBody("<p>Hi <b>there</b>.</p>") },
            },
          ],
        },
      }),
    );

    expect(result.bodyPreview).toBe("Hi there .");
    expect(result.bodyTruncated).toBe(false);
  });

  it("hard-truncates a body longer than 5,000 characters and flags it", () => {
    const longBody = "a".repeat(6_000);
    const result = extractMessageBodyPreview(
      message({
        payload: { ...message().payload, body: { data: encodeBody(longBody) } },
      }),
    );

    expect(result.bodyPreview).toHaveLength(5_000);
    expect(result.bodyTruncated).toBe(true);
  });

  it("returns null when no text part exists at all", () => {
    const result = extractMessageBodyPreview(
      message({
        payload: {
          mimeType: "multipart/mixed",
          parts: [
            {
              mimeType: "application/pdf",
              filename: "invoice.pdf",
              body: { attachmentId: "abc123", size: 4096 },
            },
          ],
        },
      }),
    );

    expect(result).toEqual({ bodyPreview: null, bodyTruncated: false });
  });
});
