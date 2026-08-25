import type * as ZendeskIntegrationModule from "@signaldesk/integrations/zendesk";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/todays-attention");
vi.mock("../_lib/evidence-sufficiency");
vi.mock("../_lib/pre-flight-policy-audit");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/recovery-strategy");
vi.mock("../_lib/sync-zendesk");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/zendesk", async (importOriginal) => {
  const actual = await importOriginal<typeof ZendeskIntegrationModule>();
  return { ...actual, postZendeskTicketReply: vi.fn() };
});

import {
  postZendeskTicketReply,
  UpstreamProviderError,
} from "@signaldesk/integrations/zendesk";
import {
  beginZendeskTicketReplySend,
  completeZendeskTicketReplySend,
  getAgentCollaboration,
  getMostRecentZendeskTicketReplySentAt,
  getSupportTicketById,
  getZendeskIntegrationById,
  recordAgentCollaborationOutcome,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { runPreFlightPolicyAudit } from "../_lib/pre-flight-policy-audit";
import { checkRateLimit } from "../_lib/rate-limit";
import { classifyRecoveryStrategy } from "../_lib/recovery-strategy";
import { getCurrentOrganization } from "../_lib/session";
import { ensureFreshZendeskAccessToken } from "../_lib/sync-zendesk";
import { getTodaysAttention } from "../_lib/todays-attention";
import { approveTicketReplyProposalAction } from "./approve-ticket-reply-action";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetAgentCollaboration = vi.mocked(getAgentCollaboration);
const mockedGetSupportTicketById = vi.mocked(getSupportTicketById);
const mockedGetZendeskIntegrationById = vi.mocked(getZendeskIntegrationById);
const mockedGetMostRecentSentAt = vi.mocked(
  getMostRecentZendeskTicketReplySentAt,
);
const mockedRecordAgentCollaborationOutcome = vi.mocked(
  recordAgentCollaborationOutcome,
);
const mockedBeginSend = vi.mocked(beginZendeskTicketReplySend);
const mockedCompleteSend = vi.mocked(completeZendeskTicketReplySend);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedGetTodaysAttention = vi.mocked(getTodaysAttention);
const mockedClassifyEvidenceSufficiency = vi.mocked(
  classifyEvidenceSufficiency,
);
const mockedRunPreFlightPolicyAudit = vi.mocked(runPreFlightPolicyAudit);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedClassifyRecoveryStrategy = vi.mocked(classifyRecoveryStrategy);
const mockedEnsureFreshAccessToken = vi.mocked(ensureFreshZendeskAccessToken);
const mockedPostReply = vi.mocked(postZendeskTicketReply);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
};

const DRAFTED_CONTENT = { body: "Following up on your ticket." };

const FRESH_COLLABORATION = {
  outcome: null,
  supportTicketId: "ticket-1",
  draftedContent: DRAFTED_CONTENT,
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

const RESUME_COLLABORATION = {
  outcome: "approved",
  supportTicketId: "ticket-1",
  draftedContent: DRAFTED_CONTENT,
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

const TICKET = {
  source: { externalRecordId: "12345", integrationId: "integration-1" },
} as unknown as Awaited<ReturnType<typeof getSupportTicketById>>;

const ACTIVE_INTEGRATION = {
  id: "integration-1",
  status: "active",
  externalAccountId: "subdomain-1",
} as unknown as Awaited<ReturnType<typeof getZendeskIntegrationById>>;

const LIVE_STUCK_FINDING = {
  type: "ticket.stuck",
  entity: { kind: "support_ticket", id: "ticket-1" },
  freshness: { status: "fresh" },
} as unknown as Awaited<
  ReturnType<typeof getTodaysAttention>
>["findings"][number];

/**
 * Behavioral coverage for the Zendesk ticket-reply approve action,
 * following `approve-invoice-reminder-action.test.ts`'s structure exactly —
 * this file's `attemptSend` mirrors invoice-reminder's most closely of the
 * three siblings: it re-checks `getZendeskIntegrationById` itself (both
 * in the outer fresh-approval flow and again inside `attemptSend`), and on
 * a disconnected integration completes the send-tracking row as "failed"
 * before returning, same as invoice-reminder's own not-connected branch.
 * Its success result carries a `sentAt` (Zendesk's ticket-update response
 * has no distinct storable comment id), same shape as invoice-reminder's.
 * `runPreFlightPolicyAudit` is called with no `expectedAmountCents` (a
 * ticket reply carries no dollar amount).
 */
describe("approveTicketReplyProposalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [LIVE_STUCK_FINDING],
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
    mockedGetZendeskIntegrationById.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedGetSupportTicketById.mockResolvedValue(TICKET);
    mockedGetMostRecentSentAt.mockResolvedValue(null);
    mockedEnsureFreshAccessToken.mockResolvedValue("access-token-1");
    mockedRecordAgentCollaborationOutcome.mockResolvedValue(
      true as unknown as Awaited<
        ReturnType<typeof recordAgentCollaborationOutcome>
      >,
    );
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
  });

  it("blocks when the collaboration is missing entirely", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(null);

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This recommendation is no longer available.",
    });
  });

  it("blocks a fresh approval when the ticket is no longer stuck, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This ticket is no longer stuck. Dismiss it instead.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "ticket_no_longer_stuck" },
      }),
    );
    expect(mockedBeginSend).not.toHaveBeenCalled();
  });

  it("blocks a fresh approval when evidence has gone stale, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("stale");

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ metadata: { reason: "evidence_stale" } }),
    );
    expect(mockedBeginSend).not.toHaveBeenCalled();
  });

  it("blocks a fresh approval when the Pre-Flight Policy Audit fails, recording the violation codes", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedRunPreFlightPolicyAudit.mockReturnValue({
      passed: false,
      violations: [
        {
          code: "duplicate_send_window",
          message: "A message was already sent for this item recently.",
        },
      ],
    });

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "A message was already sent for this item recently.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "policy_duplicate_send_window" },
      }),
    );
    expect(mockedBeginSend).not.toHaveBeenCalled();
  });

  it("blocks a fresh approval at the daily send-volume limit, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ metadata: { reason: "send_volume_limit" } }),
    );
    expect(mockedBeginSend).not.toHaveBeenCalled();
  });

  it("does not roll back the claim when the send fails with a definite (non-throwing) provider rejection", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedPostReply.mockRejectedValue(
      new UpstreamProviderError("Reply send failed.", "402 detail", 402),
    );
    mockedClassifyRecoveryStrategy.mockReturnValue({
      message: "Zendesk rejected this reply.",
    } as ReturnType<typeof classifyRecoveryStrategy>);

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "Zendesk rejected this reply.",
    });
    expect(mockedCompleteSend).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      "send-1",
      expect.objectContaining({ status: "failed" }),
    );
    // The definite-rejection path returns an `{ ok: false }` value rather
    // than throwing, so withApprovalRollback never sees an exception — the
    // outcome claim correctly stays "approved" (this really was reviewed
    // and attempted, just failed for a real reason).
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
    // Real bug found by review: ensureFreshZendeskAccessToken used to be
    // called outside the try/catch that classifies the outcome. A token-
    // refresh failure happens strictly before postZendeskTicketReply is
    // ever called, so it is never ambiguous the way a dropped connection
    // mid-send is — but the old code left the row 'pending' forever
    // anyway, permanently blocking every future retry of this
    // collaboration.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedEnsureFreshAccessToken.mockRejectedValue(
      new Error("Zendesk refresh token was revoked."),
    );

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedPostReply).not.toHaveBeenCalled();
    expect(mockedCompleteSend).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      "send-1",
      {
        status: "failed",
        failureReason: "Zendesk refresh token was revoked.",
      },
    );
  });

  it("regression: resolves the Zendesk integration by the ticket's own source.integrationId, not whichever integration is currently most-active for the org", async () => {
    // Real bug found by review: this used to resolve "whichever Zendesk
    // integration is currently most-active for this org." An org can
    // genuinely have more than one zendesk integration row over time (a
    // subdomain switch creates a new row), and an old ticket still carries
    // its original row's id forever — resolving the wrong one could
    // silently post against a different account using this ticket's
    // small-integer external id.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedPostReply.mockResolvedValue(undefined);

    await approveTicketReplyProposalAction("collab-1");

    expect(mockedGetZendeskIntegrationById).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "integration-1",
    );
  });

  it("approves and sends cleanly on the fresh happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedPostReply.mockResolvedValue(undefined);

    const result = await approveTicketReplyProposalAction("collab-1");

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

  it("resumes an already-approved collaboration by re-attempting the send directly, skipping the fresh-path guards", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedPostReply.mockResolvedValue(undefined);

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result).toEqual(
      expect.objectContaining({ ok: true, alreadySent: false }),
    );
    // The resume path never re-checks evidence, the policy audit, or the
    // rate limit — it only re-attempts the send itself.
    expect(mockedClassifyEvidenceSufficiency).not.toHaveBeenCalled();
    expect(mockedRunPreFlightPolicyAudit).not.toHaveBeenCalled();
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("resuming a send already recorded as sent returns the prior result idempotently, without calling Zendesk again", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({
      id: "send-1",
      alreadyResolved: "sent",
      sentAt: new Date("2026-08-24T00:00:00Z"),
    });

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result).toEqual({
      ok: true,
      sentAt: "2026-08-24T00:00:00.000Z",
      alreadySent: true,
    });
    expect(mockedPostReply).not.toHaveBeenCalled();
  });

  it("refuses to re-attempt a send left genuinely ambiguous (interrupted mid-flight) by a prior attempt", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({
      id: "send-1",
      alreadyResolved: "pending",
    });

    const result = await approveTicketReplyProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedPostReply).not.toHaveBeenCalled();
  });
});
