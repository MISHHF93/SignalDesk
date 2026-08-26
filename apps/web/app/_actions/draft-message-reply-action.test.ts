import type * as ApplicationModule from "@signaldesk/application";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Unlike its QuickBooks/Asana/HubSpot/Zendesk siblings (thin wrappers
// around the shared draftEntityContentAction(config) closure), this file
// is a real standalone implementation — the on-demand, single-message,
// single-specialist Agent Fabric collaboration ADR 0056 describes, and the
// literal template draftEntityContentAction itself was generalized from
// (see that file's own doc comment). Its shape mirrors
// run-agent-investigation.ts almost exactly (kill switch, rate limit,
// evidence-sufficiency gate, advisory lock, real audit trail on every
// declined trigger), just scoped to one message instead of the whole
// organization — so this test follows run-agent-investigation.test.ts's
// pattern rather than draft-invoice-reminder-action.test.ts's.
vi.mock("../_lib/session");
vi.mock("../_lib/todays-attention");
vi.mock("../_lib/evidence-sufficiency");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/agent-config");
vi.mock("../_lib/agent-fabric");
vi.mock("../_lib/agent-gateway");
vi.mock("@signaldesk/persistence");
// A partial mock, not a wholesale one: @signaldesk/application also
// exports createConsoleErrorReporter, which apps/web/app/_lib/error-
// reporter.ts's module-scoped errorReporter singleton depends on at
// import time — auto-mocking the whole package breaks that singleton.
vi.mock("@signaldesk/application", async (importOriginal) => {
  const actual = await importOriginal<typeof ApplicationModule>();
  return {
    ...actual,
    composeCards: vi.fn(),
    draftMessageReply: vi.fn(),
  };
});
vi.mock("@signaldesk/intelligence");

import { composeCards, draftMessageReply } from "@signaldesk/application";
import { prioritizeFindings } from "@signaldesk/intelligence";
import {
  completeAgentCollaboration,
  getMessageDraftContext,
  recordAuditEvent,
  startAgentCollaboration,
  withAdvisoryLock,
} from "@signaldesk/persistence";

import { isAgentFabricEnabled } from "../_lib/agent-config";
import { availabilityFor, providerFor } from "../_lib/agent-fabric";
import { createAgentGatewayService } from "../_lib/agent-gateway";
import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { getTodaysAttention } from "../_lib/todays-attention";
import { draftMessageReplyAction } from "./draft-message-reply-action";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedIsAgentFabricEnabled = vi.mocked(isAgentFabricEnabled);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetTodaysAttention = vi.mocked(getTodaysAttention);
const mockedClassifyEvidenceSufficiency = vi.mocked(
  classifyEvidenceSufficiency,
);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedStartAgentCollaboration = vi.mocked(startAgentCollaboration);
const mockedCompleteAgentCollaboration = vi.mocked(completeAgentCollaboration);
const mockedGetMessageDraftContext = vi.mocked(getMessageDraftContext);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedDraftMessageReply = vi.mocked(draftMessageReply);
const mockedPrioritizeFindings = vi.mocked(prioritizeFindings);
const mockedComposeCards = vi.mocked(composeCards);
const mockedCreateAgentGatewayService = vi.mocked(createAgentGatewayService);
const mockedAvailabilityFor = vi.mocked(availabilityFor);
const mockedProviderFor = vi.mocked(providerFor);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

const AWAITING_REPLY_FINDING = {
  id: "finding-1",
  type: "message.awaiting_reply",
  entity: { kind: "message", id: "message-1" },
  freshness: { status: "fresh" },
} as unknown as Awaited<
  ReturnType<typeof getTodaysAttention>
>["findings"][number];

describe("draftMessageReplyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsAgentFabricEnabled.mockReturnValue(true);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [AWAITING_REPLY_FINDING],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);
    mockedClassifyEvidenceSufficiency.mockReturnValue("sufficient");
    mockedWithAdvisoryLock.mockImplementation(async (_db, _key, fn) => fn());
    mockedStartAgentCollaboration.mockResolvedValue({
      id: "collab-1",
    } as Awaited<ReturnType<typeof startAgentCollaboration>>);
    mockedGetMessageDraftContext.mockResolvedValue({
      subject: "Re: your question",
      counterpartyName: "Sam",
      counterpartyEmail: "sam@example.com",
      inboundBodyText: "Can you help?",
      bodyTruncated: false,
    } as Awaited<ReturnType<typeof getMessageDraftContext>>);
    mockedCreateAgentGatewayService.mockReturnValue({
      dispatchMessageDraft: vi.fn(),
    } as unknown as ReturnType<typeof createAgentGatewayService>);
    mockedAvailabilityFor.mockReturnValue(
      {} as ReturnType<typeof availabilityFor>,
    );
    mockedProviderFor.mockReturnValue({} as ReturnType<typeof providerFor>);
    mockedDraftMessageReply.mockResolvedValue({
      status: "completed",
      confidence: 0.5,
      draftedContent: null,
    } as unknown as Awaited<ReturnType<typeof draftMessageReply>>);
    mockedPrioritizeFindings.mockReturnValue(
      [] as ReturnType<typeof prioritizeFindings>,
    );
    mockedComposeCards.mockReturnValue([] as ReturnType<typeof composeCards>);
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await draftMessageReplyAction(
      "message-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("declines honestly (not as an error) when the kill switch is off, and records why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedIsAgentFabricEnabled.mockReturnValue(false);

    const result = await draftMessageReplyAction(
      "message-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: "AI drafting is not enabled for this organization.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "message_reply_draft.declined",
        subjectType: "message",
        subjectId: "message-1",
        outcome: "denied",
        metadata: { reason: "agent_fabric_disabled" },
      }),
    );
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("refuses at the rate limit, as a real error (unlike the honest-decline cases)", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 125,
    });

    const result = await draftMessageReplyAction(
      "message-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: false,
      error: "Please wait 3 more minute(s) before drafting another reply.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ metadata: { reason: "rate_limited" } }),
    );
    expect(mockedGetTodaysAttention).not.toHaveBeenCalled();
  });

  it("declines honestly when the message is no longer awaiting a reply", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);

    const result = await draftMessageReplyAction(
      "message-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: "This message is no longer awaiting a reply.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "message_no_longer_awaiting_reply" },
      }),
    );
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
  });

  it("declines honestly when the evidence behind this message has gone stale", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("stale");

    const result = await draftMessageReplyAction(
      "message-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message:
        "The evidence behind this message hasn't refreshed recently enough to draft a reply confidently right now.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ metadata: { reason: "evidence_stale" } }),
    );
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
  });

  it("declines honestly when another draft is already running for this message", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const result = await draftMessageReplyAction(
      "message-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message:
        "A draft is already being prepared for this message. Please wait a moment and try again.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "draft_already_running" },
      }),
    );
  });

  it("completes the collaboration as failed and returns honestly when the message can no longer be loaded", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetMessageDraftContext.mockResolvedValue(null);

    const result = await draftMessageReplyAction(
      "message-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: "Could not load this message.",
    });
    expect(mockedCompleteAgentCollaboration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(mockedDraftMessageReply).not.toHaveBeenCalled();
  });

  it("returns an honest message when the specialist produces no drafted content", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);

    const result = await draftMessageReplyAction(
      "message-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: "Couldn't draft a reply right now.",
    });
    expect(mockedCompleteAgentCollaboration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("completes the collaboration and returns the composed card on a successful draft", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedDraftMessageReply.mockResolvedValue({
      status: "completed",
      confidence: 0.8,
      draftedContent: "Thanks for reaching out — here's the answer.",
    } as unknown as Awaited<ReturnType<typeof draftMessageReply>>);
    const composedCard = { id: "collab-1", type: "agent_recommendation" };
    mockedComposeCards.mockReturnValue([composedCard] as unknown as ReturnType<
      typeof composeCards
    >);

    const result = await draftMessageReplyAction(
      "message-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: composedCard,
      message: "Reply drafted.",
    });
    expect(mockedCompleteAgentCollaboration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      expect.objectContaining({
        status: "completed",
        draftedContent: "Thanks for reaching out — here's the answer.",
      }),
    );
  });

  it("returns a description of the failure when a top-level step throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetTodaysAttention.mockRejectedValue(new Error("db unavailable"));

    const result = await draftMessageReplyAction(
      "message-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({ ok: false, error: "db unavailable" });
  });
});
