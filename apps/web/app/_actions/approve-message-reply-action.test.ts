import type * as GmailIntegrationModule from "@signaldesk/integrations/gmail";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/todays-attention");
vi.mock("../_lib/evidence-sufficiency");
vi.mock("../_lib/pre-flight-policy-audit");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/recovery-strategy");
vi.mock("../_lib/sync-gmail");
vi.mock("../_lib/request-origin", () => ({
  getRequestOrigin: vi.fn().mockResolvedValue("https://app.example.com"),
}));
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/gmail", async (importOriginal) => {
  const actual = await importOriginal<typeof GmailIntegrationModule>();
  return { ...actual, sendGmailMessage: vi.fn() };
});

import {
  GmailInsufficientScopeError,
  sendGmailMessage,
  UpstreamProviderError,
} from "@signaldesk/integrations/gmail";
import {
  beginCustomerEmailReplySend,
  completeCustomerEmailReplySend,
  getAgentCollaboration,
  getGmailIntegrationStatus,
  getMessageSendContext,
  recordAgentCollaborationOutcome,
  recordAuditEvent,
  resetAgentCollaborationOutcome,
} from "@signaldesk/persistence";

import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { runPreFlightPolicyAudit } from "../_lib/pre-flight-policy-audit";
import { checkRateLimit } from "../_lib/rate-limit";
import { classifyRecoveryStrategy } from "../_lib/recovery-strategy";
import { getCurrentOrganization } from "../_lib/session";
import { ensureFreshGmailAccessToken } from "../_lib/sync-gmail";
import { getTodaysAttention } from "../_lib/todays-attention";
import { approveMessageReplyProposalAction } from "./approve-message-reply-action";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetAgentCollaboration = vi.mocked(getAgentCollaboration);
const mockedGetMessageSendContext = vi.mocked(getMessageSendContext);
const mockedBeginSend = vi.mocked(beginCustomerEmailReplySend);
const mockedCompleteSend = vi.mocked(completeCustomerEmailReplySend);
const mockedGetGmailIntegrationStatus = vi.mocked(getGmailIntegrationStatus);
const mockedRecordAgentCollaborationOutcome = vi.mocked(
  recordAgentCollaborationOutcome,
);
const mockedResetAgentCollaborationOutcome = vi.mocked(
  resetAgentCollaborationOutcome,
);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedGetTodaysAttention = vi.mocked(getTodaysAttention);
const mockedClassifyEvidenceSufficiency = vi.mocked(
  classifyEvidenceSufficiency,
);
const mockedRunPreFlightPolicyAudit = vi.mocked(runPreFlightPolicyAudit);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedClassifyRecoveryStrategy = vi.mocked(classifyRecoveryStrategy);
const mockedEnsureFreshAccessToken = vi.mocked(ensureFreshGmailAccessToken);
const mockedSendGmailMessage = vi.mocked(sendGmailMessage);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
};

const DRAFTED_CONTENT = {
  subject: "Re: your question",
  body: "Thanks for reaching out.",
};

const FRESH_COLLABORATION = {
  outcome: null,
  messageId: "message-1",
  draftedContent: DRAFTED_CONTENT,
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

const RESUME_COLLABORATION = {
  outcome: "approved",
  messageId: "message-1",
  draftedContent: DRAFTED_CONTENT,
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

const SEND_CONTEXT = {
  counterpartyEmail: "customer@example.com",
  externalThreadId: "thread-1",
  integrationId: "integration-1",
} as unknown as Awaited<ReturnType<typeof getMessageSendContext>>;

const ACTIVE_INTEGRATION = {
  id: "integration-1",
  status: "active",
} as unknown as Awaited<ReturnType<typeof getGmailIntegrationStatus>>;

const LIVE_AWAITING_REPLY_FINDING = {
  type: "message.awaiting_reply",
  entity: { kind: "message", id: "message-1" },
  freshness: { status: "fresh" },
} as unknown as Awaited<
  ReturnType<typeof getTodaysAttention>
>["findings"][number];

/**
 * `approve-message-reply-action.ts` predates the shared
 * `_lib/agent-action-approval.ts` helpers (ADR 0056, before ADR 0057
 * generalized the pattern) — its blocked/resume/fresh branching and
 * claim/rollback logic are inlined rather than shared, and it has two
 * real quirks the other 4 connectors don't: a Gmail send requires a
 * subject (checked before any DB lookup), and it distinguishes a
 * `GmailInsufficientScopeError` from a generic `UpstreamProviderError`
 * with its own dedicated message and forced `reconnectSlug`.
 */
describe("approveMessageReplyProposalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [LIVE_AWAITING_REPLY_FINDING],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);
    mockedClassifyEvidenceSufficiency.mockReturnValue("sufficient");
    mockedRunPreFlightPolicyAudit.mockReturnValue({
      passed: true,
      violations: [],
    });
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetGmailIntegrationStatus.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedGetMessageSendContext.mockResolvedValue(SEND_CONTEXT);
    mockedEnsureFreshAccessToken.mockResolvedValue("access-token-1");
    mockedRecordAgentCollaborationOutcome.mockResolvedValue({
      id: "collab-1",
    } as never);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
  });

  it("blocks when the collaboration is missing entirely", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(null);

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This recommendation is no longer available.",
    });
  });

  it("blocks an already-dismissed collaboration", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue({
      ...FRESH_COLLABORATION,
      outcome: "dismissed",
    } as typeof FRESH_COLLABORATION);

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This recommendation was already dismissed.",
    });
  });

  it("blocks a fresh approval when the message is no longer awaiting a reply", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This message is no longer awaiting a reply. Dismiss it instead.",
    });
    expect(mockedGetMessageSendContext).not.toHaveBeenCalled();
  });

  it("blocks a fresh approval when evidence has gone stale", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("stale");

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedGetMessageSendContext).not.toHaveBeenCalled();
  });

  it("blocks a fresh approval when the Pre-Flight Policy Audit fails", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedRunPreFlightPolicyAudit.mockReturnValue({
      passed: false,
      violations: [{ code: "delimiter_leak", message: "Delimiter leak." }],
    });

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "Delimiter leak." });
    expect(mockedGetMessageSendContext).not.toHaveBeenCalled();
  });

  it("blocks a fresh approval at the daily send-volume limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedGetMessageSendContext).not.toHaveBeenCalled();
  });

  it("refuses a missing subject before ever looking up the message, on both fresh and resume paths", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue({
      ...RESUME_COLLABORATION,
      draftedContent: { body: "no subject here" },
    } as typeof RESUME_COLLABORATION);

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This reply is missing a subject and cannot be sent.",
    });
    expect(mockedGetMessageSendContext).not.toHaveBeenCalled();
  });

  it("gives a Gmail-specific reconnect message on an insufficient-scope failure, without rolling back the claim", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedSendGmailMessage.mockRejectedValue(new GmailInsufficientScopeError());

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error:
        "Reconnect Gmail with expanded permissions, then try approving again.",
      reconnectSlug: "gmail",
    });
    expect(mockedResetAgentCollaborationOutcome).not.toHaveBeenCalled();
    expect(mockedClassifyRecoveryStrategy).not.toHaveBeenCalled();
  });

  it("does not roll back the claim on a definite (non-throwing outcome) provider rejection", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedSendGmailMessage.mockRejectedValue(
      new UpstreamProviderError("Send failed.", "500 detail", 500),
    );
    mockedClassifyRecoveryStrategy.mockReturnValue({
      message: "Gmail rejected this reply.",
    } as ReturnType<typeof classifyRecoveryStrategy>);

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "Gmail rejected this reply." });
    expect(mockedResetAgentCollaborationOutcome).not.toHaveBeenCalled();
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "agent_action_proposal.approved",
        outcome: "failed",
      }),
    );
  });

  it("regression: records 'failed' (not left stranded 'pending') when the access-token refresh itself fails", async () => {
    // Real bug found by review: ensureFreshGmailAccessToken used to be
    // called outside the try/catch that classifies the outcome. A token-
    // refresh failure happens strictly before sendGmailMessage is ever
    // called, so it is never ambiguous the way a dropped connection
    // mid-send is — but the old code left the row 'pending' forever
    // anyway, permanently blocking every future retry of this
    // collaboration.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedEnsureFreshAccessToken.mockRejectedValue(
      new Error("Gmail refresh token was revoked."),
    );

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedSendGmailMessage).not.toHaveBeenCalled();
    expect(mockedCompleteSend).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      "send-1",
      { status: "failed", failureReason: "Gmail refresh token was revoked." },
    );
  });

  it("approves and sends cleanly on the fresh happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedSendGmailMessage.mockResolvedValue({
      id: "gmail-msg-1",
      threadId: "thread-1",
    } as Awaited<ReturnType<typeof sendGmailMessage>>);

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual(
      expect.objectContaining({ ok: true, alreadySent: false }),
    );
    expect(mockedCompleteSend).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      "send-1",
      expect.objectContaining({ status: "sent" }),
    );
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "agent_action_proposal.approved",
        outcome: "allowed",
      }),
    );
  });

  it("regression: still reports the real successful send even when the post-send audit-event write itself fails", async () => {
    // Same real bug as the QuickBooks/HubSpot/Asana/Zendesk approve
    // actions' shared helper, independently reimplemented here since this
    // file predates that generalization: the audit-event write used to be
    // wrapped in a try/catch that reset the collaboration's claimed
    // outcome on any failure, so a transient failure recording *this*
    // event (after the real Gmail send already succeeded) made this
    // action report a failure even though the email had genuinely already
    // been sent.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedSendGmailMessage.mockResolvedValue({
      id: "gmail-msg-1",
      threadId: "thread-1",
    } as Awaited<ReturnType<typeof sendGmailMessage>>);
    mockedRecordAuditEvent.mockRejectedValue(
      new Error("audit_events insert timed out"),
    );

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual(
      expect.objectContaining({ ok: true, alreadySent: false }),
    );
  });

  it("resumes an already-approved collaboration by re-attempting the send directly, skipping the fresh-path guards", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedSendGmailMessage.mockResolvedValue({
      id: "gmail-msg-1",
      threadId: "thread-1",
    } as Awaited<ReturnType<typeof sendGmailMessage>>);

    const result = await approveMessageReplyProposalAction("collab-1");

    expect(result).toEqual(
      expect.objectContaining({ ok: true, alreadySent: false }),
    );
    expect(mockedClassifyEvidenceSufficiency).not.toHaveBeenCalled();
    expect(mockedRunPreFlightPolicyAudit).not.toHaveBeenCalled();
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });
});
