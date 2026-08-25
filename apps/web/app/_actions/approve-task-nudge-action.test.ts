import type * as AsanaIntegrationModule from "@signaldesk/integrations/asana";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/todays-attention");
vi.mock("../_lib/evidence-sufficiency");
vi.mock("../_lib/pre-flight-policy-audit");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/recovery-strategy");
vi.mock("../_lib/sync-asana");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/asana", async (importOriginal) => {
  const actual = await importOriginal<typeof AsanaIntegrationModule>();
  return { ...actual, createAsanaTaskStory: vi.fn() };
});

import {
  createAsanaTaskStory,
  UpstreamProviderError,
} from "@signaldesk/integrations/asana";
import {
  beginAsanaTaskNudgeSend,
  completeAsanaTaskNudgeSend,
  getAgentCollaboration,
  getAsanaIntegrationStatus,
  getMostRecentAsanaTaskNudgeSentAt,
  getTaskById,
  recordAgentCollaborationOutcome,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { runPreFlightPolicyAudit } from "../_lib/pre-flight-policy-audit";
import { checkRateLimit } from "../_lib/rate-limit";
import { classifyRecoveryStrategy } from "../_lib/recovery-strategy";
import { getCurrentOrganization } from "../_lib/session";
import { ensureFreshAsanaAccessToken } from "../_lib/sync-asana";
import { getTodaysAttention } from "../_lib/todays-attention";
import { approveTaskNudgeProposalAction } from "./approve-task-nudge-action";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetAgentCollaboration = vi.mocked(getAgentCollaboration);
const mockedGetTaskById = vi.mocked(getTaskById);
const mockedGetAsanaIntegrationStatus = vi.mocked(getAsanaIntegrationStatus);
const mockedGetMostRecentSentAt = vi.mocked(getMostRecentAsanaTaskNudgeSentAt);
const mockedRecordAgentCollaborationOutcome = vi.mocked(
  recordAgentCollaborationOutcome,
);
const mockedBeginSend = vi.mocked(beginAsanaTaskNudgeSend);
const mockedCompleteSend = vi.mocked(completeAsanaTaskNudgeSend);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedGetTodaysAttention = vi.mocked(getTodaysAttention);
const mockedClassifyEvidenceSufficiency = vi.mocked(
  classifyEvidenceSufficiency,
);
const mockedRunPreFlightPolicyAudit = vi.mocked(runPreFlightPolicyAudit);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedClassifyRecoveryStrategy = vi.mocked(classifyRecoveryStrategy);
const mockedEnsureFreshAccessToken = vi.mocked(ensureFreshAsanaAccessToken);
const mockedCreateTaskStory = vi.mocked(createAsanaTaskStory);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
};

const DRAFTED_CONTENT = { body: "Checking in on this overdue task." };

const FRESH_COLLABORATION = {
  outcome: null,
  taskId: "task-1",
  draftedContent: DRAFTED_CONTENT,
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

const RESUME_COLLABORATION = {
  outcome: "approved",
  taskId: "task-1",
  draftedContent: DRAFTED_CONTENT,
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

const TASK = {
  source: { integrationId: "integration-1", externalRecordId: "asana-task-1" },
} as unknown as Awaited<ReturnType<typeof getTaskById>>;

const ACTIVE_INTEGRATION = {
  id: "integration-1",
  status: "active",
  externalAccountId: "workspace-1",
} as unknown as Awaited<ReturnType<typeof getAsanaIntegrationStatus>>;

const LIVE_OVERDUE_FINDING = {
  type: "task.overdue",
  entity: { kind: "task", id: "task-1" },
  freshness: { status: "fresh" },
} as unknown as Awaited<
  ReturnType<typeof getTodaysAttention>
>["findings"][number];

/**
 * Behavioral coverage for the Asana task-nudge approve action, following
 * `approve-invoice-reminder-action.test.ts`'s structure. Real structural
 * difference from that template: like HubSpot's deal-note action,
 * `attemptSend` here never re-checks `getAsanaIntegrationStatus` itself —
 * it's only gated once, in the outer fresh-approval flow, before the claim.
 * `attemptSend` mints a fresh access token straight off the task's own
 * stored `source.integrationId`, not `integration.id`. Its success result
 * carries an `asanaStoryGid` rather than a `sentAt`, and (since a task nudge
 * carries no dollar amount) `runPreFlightPolicyAudit` is called with no
 * `expectedAmountCents` at all.
 */
describe("approveTaskNudgeProposalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [LIVE_OVERDUE_FINDING],
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
    mockedGetAsanaIntegrationStatus.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedGetTaskById.mockResolvedValue(TASK);
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

    const result = await approveTaskNudgeProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
  });

  it("blocks when the collaboration is missing entirely", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(null);

    const result = await approveTaskNudgeProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This recommendation is no longer available.",
    });
  });

  it("blocks a fresh approval when the task is no longer overdue, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);

    const result = await approveTaskNudgeProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This task is no longer overdue. Dismiss it instead.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "task_no_longer_overdue" },
      }),
    );
    expect(mockedBeginSend).not.toHaveBeenCalled();
  });

  it("blocks a fresh approval when evidence has gone stale, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("stale");

    const result = await approveTaskNudgeProposalAction("collab-1");

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

    const result = await approveTaskNudgeProposalAction("collab-1");

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

  it("blocks a fresh approval at the daily post-volume limit, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const result = await approveTaskNudgeProposalAction("collab-1");

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
    mockedCreateTaskStory.mockRejectedValue(
      new UpstreamProviderError("Nudge post failed.", "402 detail", 402),
    );
    mockedClassifyRecoveryStrategy.mockReturnValue({
      message: "Asana rejected this nudge.",
    } as ReturnType<typeof classifyRecoveryStrategy>);

    const result = await approveTaskNudgeProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "Asana rejected this nudge.",
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
    // Real bug found by review: ensureFreshAsanaAccessToken used to be
    // called outside the try/catch that classifies the outcome. A token-
    // refresh failure happens strictly before createAsanaTaskStory is ever
    // called, so it is never ambiguous the way a dropped connection
    // mid-send is — but the old code left the row 'pending' forever
    // anyway, permanently blocking every future retry of this
    // collaboration.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedEnsureFreshAccessToken.mockRejectedValue(
      new Error("Asana refresh token was revoked."),
    );

    const result = await approveTaskNudgeProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedCreateTaskStory).not.toHaveBeenCalled();
    expect(mockedCompleteSend).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      "send-1",
      { status: "failed", failureReason: "Asana refresh token was revoked." },
    );
  });

  it("approves and posts the nudge cleanly on the fresh happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedCreateTaskStory.mockResolvedValue({ storyGid: "story-1" });

    const result = await approveTaskNudgeProposalAction("collab-1");

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        asanaStoryGid: "story-1",
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
    mockedCreateTaskStory.mockResolvedValue({ storyGid: "story-1" });

    const result = await approveTaskNudgeProposalAction("collab-1");

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        asanaStoryGid: "story-1",
        alreadySent: false,
      }),
    );
    // The resume path never re-checks evidence, the policy audit, or the
    // rate limit — it only re-attempts the send itself.
    expect(mockedClassifyEvidenceSufficiency).not.toHaveBeenCalled();
    expect(mockedRunPreFlightPolicyAudit).not.toHaveBeenCalled();
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("resuming a send already recorded as sent returns the prior result idempotently, without calling Asana again", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({
      id: "send-1",
      alreadyResolved: "sent",
      asanaStoryGid: "story-existing",
    });

    const result = await approveTaskNudgeProposalAction("collab-1");

    expect(result).toEqual({
      ok: true,
      asanaStoryGid: "story-existing",
      alreadySent: true,
    });
    expect(mockedCreateTaskStory).not.toHaveBeenCalled();
  });

  it("refuses to re-attempt a send left genuinely ambiguous (interrupted mid-flight) by a prior attempt", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({
      id: "send-1",
      alreadyResolved: "pending",
    });

    const result = await approveTaskNudgeProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedCreateTaskStory).not.toHaveBeenCalled();
  });

  it("regression: blocks a resumed send when Asana was disconnected since the original approval, instead of attempting a token refresh", async () => {
    // Real inconsistency found by review: unlike the QuickBooks/Zendesk
    // approve actions, attemptSend here never re-checked Asana's connection
    // status at all — only the fresh-approval path did, which the resume
    // path skips entirely. A disconnect between the original approval and
    // a resumed retry fell through to ensureFreshAsanaAccessToken with no
    // clean "reconnect" messaging.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedGetAsanaIntegrationStatus.mockResolvedValue(null);

    const result = await approveTaskNudgeProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "Reconnect Asana to post this nudge.",
    });
    expect(mockedEnsureFreshAccessToken).not.toHaveBeenCalled();
    expect(mockedCreateTaskStory).not.toHaveBeenCalled();
    expect(mockedCompleteSend).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      "send-1",
      { status: "failed", failureReason: "Asana is not connected." },
    );
  });
});
