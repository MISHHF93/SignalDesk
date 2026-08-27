import {
  evaluateMessageAwaitingReply,
  normalizeEntityName,
} from "@signaldesk/domain";

import type {
  IntelligenceCapability,
  IntelligenceContext,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { formatHours, freshnessStatus } from "../format";

/**
 * The real, visible consumer of Gmail message ingestion (Phase 4b,
 * implementation roadmap) — an inbound external message with no later
 * outbound reply, past the organization's own response-time threshold,
 * becomes a finding. Mirrors `overdueTaskIntelligence` exactly: evaluates
 * every candidate in `context.recentUnansweredMessages`, not just one,
 * since each is an independent risk item. Never reads
 * `message.bodyPreview` — `Message` (`@signaldesk/domain`) has no such
 * field at all, a structural guarantee, not a convention (see that
 * type's own doc comment).
 */
export const messageFollowUpIntelligence: IntelligenceCapability = {
  id: "message-follow-up",
  description:
    "Detects real inbound messages that have gone unanswered past the response-time threshold.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const {
      recentUnansweredMessages,
      now,
      defaultExpectedResponseHours,
      workingDaysBitmask,
      timeZone,
    } = context;
    const findings: IntelligenceFinding[] = [];

    for (const message of recentUnansweredMessages) {
      const signal = evaluateMessageAwaitingReply(
        message,
        now,
        defaultExpectedResponseHours,
        undefined,
        workingDaysBitmask,
        timeZone,
      );

      if (!signal) {
        continue;
      }

      const sourceFreshnessMinutes = Math.max(
        0,
        Math.floor(
          (now.getTime() - message.source.lastSyncedAt.getTime()) / 60_000,
        ),
      );
      const counterparty =
        message.counterpartyName ?? message.counterpartyEmail;
      // Real bug found by review: this used to interpolate the raw
      // fractional-hours float directly (e.g. "76.61666666666667 hours
      // elapsed") — ticket-risk.ts/lead-risk.ts already format the
      // identical field via formatHours, this one just never got the
      // same treatment.
      const elapsedLabel = formatHours(signal.elapsedHours);

      findings.push({
        id: `message-follow-up:${message.organizationId}:${message.id}`,
        type: "message.awaiting_reply",
        entity: { kind: "message", id: message.id },
        // Only the real counterparty *name*, never falling back to the
        // email the way `counterparty` (used for display) does above —
        // this pass's correlation is deliberately name-only, matching
        // `@signaldesk/data-quality`'s existing exact-match discipline,
        // not a separate email-based matching scheme layered on top.
        ...(message.counterpartyName
          ? { correlationName: normalizeEntityName(message.counterpartyName) }
          : {}),
        title: `Message from ${counterparty} awaiting reply`,
        summary: signal.explanation,
        severity: signal.severity,
        confidence: CONFIDENCE_DETERMINISTIC_RULE,
        evidence: signal.evidence.map((reference) => ({ ...reference })),
        freshness: {
          asOf: message.source.lastSyncedAt,
          status: freshnessStatus(sourceFreshnessMinutes),
        },
        explanation: {
          trigger:
            "Inbound message exceeded the response-time threshold with no outbound reply.",
          observedValue: `${elapsedLabel} hours elapsed`,
          expectedBaseline: `${signal.thresholdHours}-hour response threshold`,
          confidence: "high",
        },
        recommendedActionTypes: ["create_internal_task"],
        detectedAt: now,
      });
    }

    return findings;
  },
};
