import { describe, expect, it } from "vitest";

import { evaluateMessageAwaitingReply, type Message } from "../src/index";

const occurredAt = new Date("2026-08-17T12:00:00.000Z");

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-001",
    organizationId: "org-001",
    leadId: null,
    externalThreadId: "thread-001",
    direction: "inbound",
    counterpartyEmail: "jane@clientco.com",
    counterpartyName: "Jane Client",
    subject: "Re: Q3 proposal",
    snippet: "Following up on the proposal...",
    occurredAt,
    source: {
      integrationId: "44444444-4444-4444-8444-444444444444",
      system: "gmail",
      externalRecordId: "external-message-001",
      sourceVersion: "1755432000000",
      recordDigestSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
    },
    ...overrides,
  };
}

describe("evaluateMessageAwaitingReply", () => {
  it("does not surface a message before its response threshold", () => {
    const signal = evaluateMessageAwaitingReply(
      makeMessage(),
      new Date("2026-08-17T23:59:59.999Z"),
      24,
    );

    expect(signal).toBeNull();
  });

  it("surfaces an inbound message exactly at the response threshold", () => {
    const signal = evaluateMessageAwaitingReply(
      makeMessage(),
      new Date("2026-08-18T12:00:00.000Z"),
      24,
    );

    expect(signal).toEqual({
      id: "message.awaiting_reply:org-001:message-001",
      type: "message.awaiting_reply",
      messageId: "message-001",
      organizationId: "org-001",
      severity: "high",
      elapsedHours: 24,
      thresholdHours: 24,
      explanation:
        'A message from Jane Client ("Re: Q3 proposal") has had no reply for 24 hours.',
      recommendedAction:
        "Reply to Jane Client or record why this doesn't need a response.",
      evidence: [
        {
          integrationId: "44444444-4444-4444-8444-444444444444",
          system: "gmail",
          externalRecordId: "external-message-001",
          sourceVersion: "1755432000000",
          recordDigestSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
        },
      ],
    });
  });

  it("ignores an outbound message entirely (nothing to wait on a reply for)", () => {
    const signal = evaluateMessageAwaitingReply(
      makeMessage({ direction: "outbound" }),
      new Date("2026-08-20T12:00:00.000Z"),
      24,
    );

    expect(signal).toBeNull();
  });

  it("falls back to the counterparty email when no display name is known", () => {
    const signal = evaluateMessageAwaitingReply(
      makeMessage({ counterpartyName: null }),
      new Date("2026-08-18T12:00:00.000Z"),
      24,
    );

    expect(signal?.explanation).toContain("jane@clientco.com");
  });

  it("classifies severity as critical at or above the critical-hours-past-threshold boundary", () => {
    // expectedResponseHours=24, criticalResponseHours=72: critical once
    // elapsed is 72h *past* the 24h threshold, i.e. 96h total elapsed.
    const signal = evaluateMessageAwaitingReply(
      makeMessage(),
      new Date("2026-08-21T12:00:00.000Z"),
      24,
      72,
    );

    expect(signal?.elapsedHours).toBe(96);
    expect(signal?.severity).toBe("critical");
  });

  it("classifies severity as high just under the critical-hours-past-threshold boundary", () => {
    const signal = evaluateMessageAwaitingReply(
      makeMessage(),
      new Date("2026-08-21T11:59:59.999Z"),
      24,
      72,
    );

    expect(signal?.severity).toBe("high");
  });

  it("uses the default 72-hour critical threshold when none is supplied", () => {
    const belowDefault = evaluateMessageAwaitingReply(
      makeMessage(),
      new Date("2026-08-21T11:59:59.999Z"),
      24,
    );
    const atDefault = evaluateMessageAwaitingReply(
      makeMessage(),
      new Date("2026-08-21T12:00:00.000Z"),
      24,
    );

    expect(belowDefault?.severity).toBe("high");
    expect(atDefault?.severity).toBe("critical");
  });

  it("does not collapse to critical-only when the org's own response threshold exceeds 72 hours", () => {
    // Regression test: severity used to compare total elapsed time against
    // the flat 72h default, so any org configured with a >72h response
    // threshold would see every finding report "critical" the instant it
    // fired, since elapsedHours could never be below expectedResponseHours.
    const justPastThreshold = evaluateMessageAwaitingReply(
      makeMessage(),
      new Date("2026-08-21T16:00:00.000Z"), // 100 hours elapsed
      100,
    );

    expect(justPastThreshold?.elapsedHours).toBe(100);
    expect(justPastThreshold?.severity).toBe("high");

    const wellPastThreshold = evaluateMessageAwaitingReply(
      makeMessage(),
      new Date("2026-08-24T16:00:00.000Z"), // 100 + 72 hours elapsed
      100,
    );

    expect(wellPastThreshold?.severity).toBe("critical");
  });

  it.each([
    ["invalid current time", makeMessage(), new Date("invalid"), 24],
    [
      "invalid occurredAt",
      makeMessage({ occurredAt: new Date("invalid") }),
      new Date("2026-08-18T12:00:00.000Z"),
      24,
    ],
    [
      "invalid source sync time",
      makeMessage({
        source: { ...makeMessage().source, lastSyncedAt: new Date("invalid") },
      }),
      new Date("2026-08-18T12:00:00.000Z"),
      24,
    ],
    [
      "negative response threshold",
      makeMessage(),
      new Date("2026-08-18T12:00:00.000Z"),
      -1,
    ],
    [
      "zero response threshold",
      makeMessage(),
      new Date("2026-08-18T12:00:00.000Z"),
      0,
    ],
  ])(
    "fails closed for %s",
    (_caseName, message, now, expectedResponseHours) => {
      expect(
        evaluateMessageAwaitingReply(message, now, expectedResponseHours),
      ).toBeNull();
    },
  );

  it("does not report a negative elapsed duration when clocks are skewed", () => {
    const signal = evaluateMessageAwaitingReply(
      makeMessage(),
      new Date("2026-08-17T11:59:59.999Z"),
      24,
    );

    expect(signal).toBeNull();
  });

  const MON_FRI_BITMASK = 0b0111110; // Sun=0 ... Sat=6; Mon-Fri set

  it("does not flag a Friday-evening message as neglected by Saturday morning for a Mon-Fri business", () => {
    const signal = evaluateMessageAwaitingReply(
      makeMessage({ occurredAt: new Date("2026-08-14T18:00:00.000Z") }),
      new Date("2026-08-15T09:00:00.000Z"),
      24,
      72,
      MON_FRI_BITMASK,
      "UTC",
    );

    expect(signal).toBeNull();
  });

  it("counts only working-day hours once the weekend has fully passed", () => {
    const signal = evaluateMessageAwaitingReply(
      makeMessage({ occurredAt: new Date("2026-08-14T18:00:00.000Z") }),
      new Date("2026-08-17T10:00:00.000Z"),
      12,
      72,
      MON_FRI_BITMASK,
      "UTC",
    );

    expect(signal).not.toBeNull();
    expect(signal?.elapsedHours).toBe(16);
  });

  it("clones the source sync date and preserves every provenance field", () => {
    const message = makeMessage();
    const signal = evaluateMessageAwaitingReply(
      message,
      new Date("2026-08-18T12:00:00.000Z"),
      24,
    );

    expect(signal?.evidence[0]?.lastSyncedAt).not.toBe(
      message.source.lastSyncedAt,
    );
    expect(signal?.evidence[0]).toEqual(message.source);
  });
});
