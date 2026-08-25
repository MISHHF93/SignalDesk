import type * as HubSpotIntegrationModule from "@signaldesk/integrations/hubspot";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/todays-attention");
vi.mock("../_lib/evidence-sufficiency");
vi.mock("../_lib/pre-flight-policy-audit");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/recovery-strategy");
vi.mock("../_lib/sync-hubspot");
vi.mock("../_lib/request-origin");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/hubspot", async (importOriginal) => {
  const actual = await importOriginal<typeof HubSpotIntegrationModule>();
  return { ...actual, createHubSpotDealNote: vi.fn() };
});

import {
  createHubSpotDealNote,
  UpstreamProviderError,
} from "@signaldesk/integrations/hubspot";
import {
  beginHubSpotDealNoteSend,
  completeHubSpotDealNoteSend,
  getAgentCollaboration,
  getHubSpotIntegrationStatus,
  getLeadById,
  getMostRecentHubSpotDealNoteSentAt,
  recordAgentCollaborationOutcome,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { runPreFlightPolicyAudit } from "../_lib/pre-flight-policy-audit";
import { checkRateLimit } from "../_lib/rate-limit";
import { classifyRecoveryStrategy } from "../_lib/recovery-strategy";
import { getRequestOrigin } from "../_lib/request-origin";
import { getCurrentOrganization } from "../_lib/session";
import { ensureFreshHubSpotAccessToken } from "../_lib/sync-hubspot";
import { getTodaysAttention } from "../_lib/todays-attention";
import { approveDealNoteProposalAction } from "./approve-deal-note-action";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetAgentCollaboration = vi.mocked(getAgentCollaboration);
const mockedGetLeadById = vi.mocked(getLeadById);
const mockedGetHubSpotIntegrationStatus = vi.mocked(
  getHubSpotIntegrationStatus,
);
const mockedGetMostRecentSentAt = vi.mocked(getMostRecentHubSpotDealNoteSentAt);
const mockedRecordAgentCollaborationOutcome = vi.mocked(
  recordAgentCollaborationOutcome,
);
const mockedBeginSend = vi.mocked(beginHubSpotDealNoteSend);
const mockedCompleteSend = vi.mocked(completeHubSpotDealNoteSend);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedGetTodaysAttention = vi.mocked(getTodaysAttention);
const mockedClassifyEvidenceSufficiency = vi.mocked(
  classifyEvidenceSufficiency,
);
const mockedRunPreFlightPolicyAudit = vi.mocked(runPreFlightPolicyAudit);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedClassifyRecoveryStrategy = vi.mocked(classifyRecoveryStrategy);
const mockedGetRequestOrigin = vi.mocked(getRequestOrigin);
const mockedEnsureFreshAccessToken = vi.mocked(ensureFreshHubSpotAccessToken);
const mockedCreateDealNote = vi.mocked(createHubSpotDealNote);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
};

const DRAFTED_CONTENT = { body: "Following up on this deal." };

const FRESH_COLLABORATION = {
  outcome: null,
  leadId: "lead-1",
  draftedContent: DRAFTED_CONTENT,
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

const RESUME_COLLABORATION = {
  outcome: "approved",
  leadId: "lead-1",
  draftedContent: DRAFTED_CONTENT,
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

const LEAD = {
  valueCents: 5000,
  source: { integrationId: "integration-1", externalRecordId: "hs-lead-1" },
} as unknown as Awaited<ReturnType<typeof getLeadById>>;

const ACTIVE_INTEGRATION = {
  id: "integration-1",
  status: "active",
  externalAccountId: "portal-1",
} as unknown as Awaited<ReturnType<typeof getHubSpotIntegrationStatus>>;

const LIVE_AT_RISK_FINDING = {
  type: "lead.follow_up_risk",
  entity: { kind: "lead", id: "lead-1" },
  freshness: { status: "fresh" },
} as unknown as Awaited<
  ReturnType<typeof getTodaysAttention>
>["findings"][number];

/**
 * Behavioral coverage for the HubSpot deal-note approve action, following
 * `approve-invoice-reminder-action.test.ts`'s structure. Real structural
 * difference from that template: `attemptSend` here never re-checks
 * `getHubSpotIntegrationStatus` itself — the connection is only gated once,
 * in the outer fresh-approval flow, before the claim. `attemptSend` fetches
 * a fresh access token straight off the lead's own stored
 * `source.integrationId`, so there is no "attemptSend sees a disconnected
 * integration" branch to test the way invoice-reminder's has. It also calls
 * `getRequestOrigin()` (mocked here) before minting that access token, and
 * its success result carries a `hubspotNoteId` rather than a `sentAt`.
 */
describe("approveDealNoteProposalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [LIVE_AT_RISK_FINDING],
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
    mockedGetHubSpotIntegrationStatus.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedGetLeadById.mockResolvedValue(LEAD);
    mockedGetMostRecentSentAt.mockResolvedValue(null);
    mockedGetRequestOrigin.mockResolvedValue("https://app.example.com");
    mockedEnsureFreshAccessToken.mockResolvedValue("access-token-1");
    mockedRecordAgentCollaborationOutcome.mockResolvedValue(
      true as unknown as Awaited<
        ReturnType<typeof recordAgentCollaborationOutcome>
      >,
    );
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
  });

  it("blocks when the collaboration is missing entirely", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(null);

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This recommendation is no longer available.",
    });
  });

  it("blocks a fresh approval when the deal is no longer at risk, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This deal is no longer at risk. Dismiss it instead.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "deal_no_longer_at_risk" },
      }),
    );
    expect(mockedBeginSend).not.toHaveBeenCalled();
  });

  it("blocks a fresh approval when evidence has gone stale, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("stale");

    const result = await approveDealNoteProposalAction("collab-1");

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
      violations: [{ code: "amount_mismatch", message: "Amount mismatch." }],
    });

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "Amount mismatch." });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "policy_amount_mismatch" },
      }),
    );
    expect(mockedBeginSend).not.toHaveBeenCalled();
  });

  it("regression: never passes expectedAmountCents to the Pre-Flight Policy Audit, even for a valued lead", async () => {
    // Real bug found by review: this used to pass expectedAmountCents
    // whenever the lead had a nonzero valueCents, but a deal note is
    // free-text relationship content with no expected dollar figure —
    // pre-flight-policy-audit.ts's own doc comment says only an invoice
    // reminder carries one. Passing it permanently blocked every
    // deterministically-drafted deal note for a valued lead (that
    // template never states a dollar amount) with an "amount mismatch"
    // violation.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedCreateDealNote.mockResolvedValue({ noteId: "note-1" });

    await approveDealNoteProposalAction("collab-1");

    expect(mockedRunPreFlightPolicyAudit).toHaveBeenCalledWith(
      expect.not.objectContaining({ expectedAmountCents: expect.anything() }),
    );
  });

  it("blocks a fresh approval at the daily post-volume limit, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ metadata: { reason: "post_volume_limit" } }),
    );
    expect(mockedBeginSend).not.toHaveBeenCalled();
  });

  it("does not roll back the claim when the send fails with a definite (non-throwing) provider rejection", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedCreateDealNote.mockRejectedValue(
      new UpstreamProviderError("Note creation failed.", "402 detail", 402),
    );
    mockedClassifyRecoveryStrategy.mockReturnValue({
      message: "HubSpot rejected this note.",
    } as ReturnType<typeof classifyRecoveryStrategy>);

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "HubSpot rejected this note.",
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
    // Real bug found by review: ensureFreshHubSpotAccessToken used to be
    // called outside the try/catch that classifies the outcome. A token-
    // refresh failure happens strictly before createHubSpotDealNote is
    // ever called, so it is never ambiguous the way a dropped connection
    // mid-send is — but the old code left the row 'pending' forever
    // anyway, permanently blocking every future retry of this
    // collaboration.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedEnsureFreshAccessToken.mockRejectedValue(
      new Error("HubSpot refresh token was revoked."),
    );

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedCreateDealNote).not.toHaveBeenCalled();
    expect(mockedCompleteSend).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      "send-1",
      {
        status: "failed",
        failureReason: "HubSpot refresh token was revoked.",
      },
    );
  });

  it("regression: fetches the lead only once on a fresh approval, reusing the audit fetch for the send instead of refetching", async () => {
    // Real inefficiency found by review: attemptSend used to call
    // getLeadById itself even though the fresh-approval path had already
    // fetched the same lead moments earlier for the Pre-Flight Policy
    // Audit — a redundant DB round trip on every single approval.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedCreateDealNote.mockResolvedValue({ noteId: "note-1" });

    await approveDealNoteProposalAction("collab-1");

    expect(mockedGetLeadById).toHaveBeenCalledTimes(1);
  });

  it("approves and logs the note cleanly on the fresh happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedCreateDealNote.mockResolvedValue({ noteId: "note-1" });

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        hubspotNoteId: "note-1",
        alreadySent: false,
      }),
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
    mockedCreateDealNote.mockResolvedValue({ noteId: "note-1" });

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        hubspotNoteId: "note-1",
        alreadySent: false,
      }),
    );
    // The resume path never re-checks evidence, the policy audit, or the
    // rate limit — it only re-attempts the send itself.
    expect(mockedClassifyEvidenceSufficiency).not.toHaveBeenCalled();
    expect(mockedRunPreFlightPolicyAudit).not.toHaveBeenCalled();
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("resuming a send already recorded as sent returns the prior result idempotently, without calling HubSpot again", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({
      id: "send-1",
      alreadyResolved: "sent",
      hubspotNoteId: "note-existing",
    });

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result).toEqual({
      ok: true,
      hubspotNoteId: "note-existing",
      alreadySent: true,
    });
    expect(mockedCreateDealNote).not.toHaveBeenCalled();
  });

  it("refuses to re-attempt a send left genuinely ambiguous (interrupted mid-flight) by a prior attempt", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({
      id: "send-1",
      alreadyResolved: "pending",
    });

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedCreateDealNote).not.toHaveBeenCalled();
  });

  it("regression: blocks a resumed send when HubSpot was disconnected since the original approval, instead of attempting a token refresh", async () => {
    // Real inconsistency found by review: unlike the QuickBooks/Zendesk
    // approve actions, attemptSend here never re-checked HubSpot's
    // connection status at all — only the fresh-approval path did, which
    // the resume path skips entirely. A disconnect between the original
    // approval and a resumed retry fell through to
    // ensureFreshHubSpotAccessToken with no clean "reconnect" messaging.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedGetHubSpotIntegrationStatus.mockResolvedValue(null);

    const result = await approveDealNoteProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "Reconnect HubSpot to log this note.",
    });
    expect(mockedEnsureFreshAccessToken).not.toHaveBeenCalled();
    expect(mockedCreateDealNote).not.toHaveBeenCalled();
    expect(mockedCompleteSend).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      "send-1",
      { status: "failed", failureReason: "HubSpot is not connected." },
    );
  });
});
