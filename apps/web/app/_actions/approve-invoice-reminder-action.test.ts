import type * as QuickBooksIntegrationModule from "@signaldesk/integrations/quickbooks";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/todays-attention");
vi.mock("../_lib/evidence-sufficiency");
vi.mock("../_lib/pre-flight-policy-audit");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/recovery-strategy");
vi.mock("../_lib/sync-quickbooks");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/quickbooks", async (importOriginal) => {
  const actual = await importOriginal<typeof QuickBooksIntegrationModule>();
  return { ...actual, sendQuickBooksInvoiceReminder: vi.fn() };
});

import {
  sendQuickBooksInvoiceReminder,
  UpstreamProviderError,
} from "@signaldesk/integrations/quickbooks";
import {
  beginQuickBooksInvoiceReminderSend,
  completeQuickBooksInvoiceReminderSend,
  getAgentCollaboration,
  getInvoiceById,
  getMostRecentQuickBooksInvoiceReminderSentAt,
  getQuickBooksIntegrationStatus,
  recordAgentCollaborationOutcome,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { runPreFlightPolicyAudit } from "../_lib/pre-flight-policy-audit";
import { checkRateLimit } from "../_lib/rate-limit";
import { classifyRecoveryStrategy } from "../_lib/recovery-strategy";
import { getCurrentOrganization } from "../_lib/session";
import { ensureFreshQuickBooksAccessToken } from "../_lib/sync-quickbooks";
import { getTodaysAttention } from "../_lib/todays-attention";
import { approveInvoiceReminderProposalAction } from "./approve-invoice-reminder-action";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetAgentCollaboration = vi.mocked(getAgentCollaboration);
const mockedGetInvoiceById = vi.mocked(getInvoiceById);
const mockedGetQuickBooksIntegrationStatus = vi.mocked(
  getQuickBooksIntegrationStatus,
);
const mockedGetMostRecentSentAt = vi.mocked(
  getMostRecentQuickBooksInvoiceReminderSentAt,
);
const mockedRecordAgentCollaborationOutcome = vi.mocked(
  recordAgentCollaborationOutcome,
);
const mockedBeginSend = vi.mocked(beginQuickBooksInvoiceReminderSend);
const mockedCompleteSend = vi.mocked(completeQuickBooksInvoiceReminderSend);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedGetTodaysAttention = vi.mocked(getTodaysAttention);
const mockedClassifyEvidenceSufficiency = vi.mocked(
  classifyEvidenceSufficiency,
);
const mockedRunPreFlightPolicyAudit = vi.mocked(runPreFlightPolicyAudit);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedClassifyRecoveryStrategy = vi.mocked(classifyRecoveryStrategy);
const mockedEnsureFreshAccessToken = vi.mocked(
  ensureFreshQuickBooksAccessToken,
);
const mockedSendReminder = vi.mocked(sendQuickBooksInvoiceReminder);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
};

const DRAFTED_CONTENT = { subject: "Reminder", body: "Please pay soon." };

const FRESH_COLLABORATION = {
  outcome: null,
  invoiceId: "invoice-1",
  draftedContent: DRAFTED_CONTENT,
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

const RESUME_COLLABORATION = {
  outcome: "approved",
  invoiceId: "invoice-1",
  draftedContent: DRAFTED_CONTENT,
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

const INVOICE = {
  amountCents: 5000,
  source: { externalRecordId: "qb-invoice-1" },
} as unknown as Awaited<ReturnType<typeof getInvoiceById>>;

const ACTIVE_INTEGRATION = {
  id: "integration-1",
  status: "active",
  externalAccountId: "realm-1",
} as unknown as Awaited<ReturnType<typeof getQuickBooksIntegrationStatus>>;

const LIVE_OVERDUE_FINDING = {
  type: "invoice.overdue",
  entity: { kind: "invoice", id: "invoice-1" },
  freshness: { status: "fresh" },
} as unknown as Awaited<
  ReturnType<typeof getTodaysAttention>
>["findings"][number];

/**
 * Real behavioral coverage for the most complex, highest-real-money-risk
 * approve action in this app (a real QuickBooks invoice-reminder send).
 * `classifyEvidenceSufficiency`, `runPreFlightPolicyAudit`, and
 * `classifyRecoveryStrategy` each already have their own dedicated test
 * files — mocked directly here so these tests exercise only this file's
 * own orchestration (path selection, ordering of guards, rollback vs.
 * no-rollback), not re-derive already-tested logic.
 */
describe("approveInvoiceReminderProposalAction", () => {
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
    mockedGetQuickBooksIntegrationStatus.mockResolvedValue(ACTIVE_INTEGRATION);
    mockedGetInvoiceById.mockResolvedValue(INVOICE);
    mockedGetMostRecentSentAt.mockResolvedValue(null);
    mockedEnsureFreshAccessToken.mockResolvedValue("access-token-1");
    mockedRecordAgentCollaborationOutcome.mockResolvedValue({
      id: "collab-1",
    } as never);
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await approveInvoiceReminderProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
  });

  it("blocks when the collaboration is missing entirely", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(null);

    const result = await approveInvoiceReminderProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This recommendation is no longer available.",
    });
  });

  it("blocks a fresh approval when the invoice is no longer overdue, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);

    const result = await approveInvoiceReminderProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This invoice is no longer overdue. Dismiss it instead.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "invoice_no_longer_overdue" },
      }),
    );
    expect(mockedBeginSend).not.toHaveBeenCalled();
  });

  it("blocks a fresh approval when evidence has gone stale, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("stale");

    const result = await approveInvoiceReminderProposalAction("collab-1");

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

    const result = await approveInvoiceReminderProposalAction("collab-1");

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

  it("blocks a fresh approval at the daily send-volume limit, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const result = await approveInvoiceReminderProposalAction("collab-1");

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
    mockedSendReminder.mockRejectedValue(
      new UpstreamProviderError("Reminder send failed.", "402 detail", 402),
    );
    mockedClassifyRecoveryStrategy.mockReturnValue({
      message: "QuickBooks rejected this reminder.",
    } as ReturnType<typeof classifyRecoveryStrategy>);

    const result = await approveInvoiceReminderProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "QuickBooks rejected this reminder.",
    });
    expect(mockedCompleteSend).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      "send-1",
      expect.objectContaining({ status: "failed" }),
    );
    // The definite-rejection path returns an `{ ok: false }` value rather
    // than throwing, so withApprovalRollback never sees an exception —
    // the outcome claim correctly stays "approved" (this really was
    // reviewed and attempted, just failed for a real reason), matching
    // the source's own reasoning for why this isn't rolled back.
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
    // Real bug found by review: ensureFreshQuickBooksAccessToken used to be
    // called outside the try/catch that classifies the outcome. A token-
    // refresh failure (a revoked refresh token, no stored tokens at all)
    // happens strictly before sendQuickBooksInvoiceReminder is ever called,
    // so it is never ambiguous the way a dropped connection mid-send is —
    // but the old code left the row 'pending' forever anyway, permanently
    // blocking every future retry of this same collaboration.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedEnsureFreshAccessToken.mockRejectedValue(
      new Error("QuickBooks refresh token was revoked."),
    );

    const result = await approveInvoiceReminderProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedSendReminder).not.toHaveBeenCalled();
    expect(mockedCompleteSend).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      "send-1",
      {
        status: "failed",
        failureReason: "QuickBooks refresh token was revoked.",
      },
    );
  });

  it("approves and sends cleanly on the fresh happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedSendReminder.mockResolvedValue(undefined);

    const result = await approveInvoiceReminderProposalAction("collab-1");

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
    // Real bug found by review: the audit-event write used to be wrapped in
    // withApprovalRollback, so a transient failure recording *this* event
    // (after the real QuickBooks send already succeeded) reset the
    // collaboration's claimed outcome back to null and made this whole
    // action report a failure — even though the invoice reminder had
    // genuinely already been sent. The fix must report the real result
    // regardless of whether the trailing audit write succeeds.
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(FRESH_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedSendReminder.mockResolvedValue(undefined);
    mockedRecordAuditEvent.mockRejectedValue(
      new Error("audit_events insert timed out"),
    );

    const result = await approveInvoiceReminderProposalAction("collab-1");

    expect(result).toEqual(
      expect.objectContaining({ ok: true, alreadySent: false }),
    );
  });

  it("resumes an already-approved collaboration by re-attempting the send directly, skipping the fresh-path guards", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({ id: "send-1", alreadyResolved: null });
    mockedSendReminder.mockResolvedValue(undefined);

    const result = await approveInvoiceReminderProposalAction("collab-1");

    expect(result).toEqual(
      expect.objectContaining({ ok: true, alreadySent: false }),
    );
    // The resume path never re-checks evidence, the policy audit, or the
    // rate limit — it only re-attempts the send itself.
    expect(mockedClassifyEvidenceSufficiency).not.toHaveBeenCalled();
    expect(mockedRunPreFlightPolicyAudit).not.toHaveBeenCalled();
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("resuming a send already recorded as sent returns the prior result idempotently, without calling QuickBooks again", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({
      id: "send-1",
      alreadyResolved: "sent",
      sentAt: new Date("2026-08-24T00:00:00Z"),
    });

    const result = await approveInvoiceReminderProposalAction("collab-1");

    expect(result).toEqual({
      ok: true,
      sentAt: "2026-08-24T00:00:00.000Z",
      alreadySent: true,
    });
    expect(mockedSendReminder).not.toHaveBeenCalled();
  });

  it("refuses to re-attempt a send left genuinely ambiguous (interrupted mid-flight) by a prior attempt", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(RESUME_COLLABORATION);
    mockedBeginSend.mockResolvedValue({
      id: "send-1",
      alreadyResolved: "pending",
    });

    const result = await approveInvoiceReminderProposalAction("collab-1");

    expect(result.ok).toBe(false);
    expect(mockedSendReminder).not.toHaveBeenCalled();
  });
});
