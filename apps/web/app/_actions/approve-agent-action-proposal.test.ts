import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/todays-attention");
vi.mock("../_lib/evidence-sufficiency");
vi.mock("@signaldesk/persistence");

import {
  createInternalTask,
  getAgentCollaboration,
  recordAgentCollaborationOutcome,
  recordAuditEvent,
  resetAgentCollaborationOutcome,
} from "@signaldesk/persistence";

import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { getCurrentOrganization } from "../_lib/session";
import { getTodaysAttention } from "../_lib/todays-attention";
import { approveAgentActionProposalAction } from "./approve-agent-action-proposal";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetAgentCollaboration = vi.mocked(getAgentCollaboration);
const mockedClassifyEvidenceSufficiency = vi.mocked(
  classifyEvidenceSufficiency,
);
const mockedRecordAgentCollaborationOutcome = vi.mocked(
  recordAgentCollaborationOutcome,
);
const mockedResetAgentCollaborationOutcome = vi.mocked(
  resetAgentCollaborationOutcome,
);
const mockedCreateInternalTask = vi.mocked(createInternalTask);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedGetTodaysAttention = vi.mocked(getTodaysAttention);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
};

const COLLABORATION = {
  id: "collab-1",
  status: "completed",
  objective: "investigate overdue invoice",
  pattern: "single_specialist",
  messageId: null,
  invoiceId: "invoice-1",
  taskId: null,
  leadId: null,
  supportTicketId: null,
  draftedContent: null,
  reconciledSummary: "Invoice #123 is 14 days overdue for Acme Co.",
  reconciledConfidenceBasisPoints: 8500,
  contradictionsDetected: false,
  startedAt: new Date("2026-08-20T00:00:00Z"),
  completedAt: new Date("2026-08-20T00:01:00Z"),
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

/**
 * Real behavioral coverage for the Agent Fabric's one real
 * approve-a-recommendation path — not the mechanical role-gate pattern
 * used elsewhere in this directory, since this file's actual risk is
 * concurrency/rollback correctness (ADR 0027's `outcome is null` claim
 * guard), not authorization. `classifyEvidenceSufficiency` is mocked
 * directly (it has its own test file, evidence-sufficiency.test.ts) so
 * this file's tests exercise only `approveAgentActionProposalAction`'s
 * own orchestration, not re-derive that function's own logic.
 */
describe("approveAgentActionProposalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);
  });

  it("returns early with no session and performs no lookup", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await approveAgentActionProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedGetAgentCollaboration).not.toHaveBeenCalled();
  });

  it("refuses when the collaboration no longer exists", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(null);

    const result = await approveAgentActionProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This investigation is no longer available.",
    });
    expect(mockedRecordAgentCollaborationOutcome).not.toHaveBeenCalled();
  });

  it("refuses when the collaboration has no reconciled summary yet", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue({
      ...COLLABORATION,
      reconciledSummary: null,
    } as typeof COLLABORATION);

    const result = await approveAgentActionProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This investigation is no longer available.",
    });
    expect(mockedRecordAgentCollaborationOutcome).not.toHaveBeenCalled();
  });

  it("blocks approval and records a denied audit event when evidence has gone stale, without claiming an outcome or creating a task", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(COLLABORATION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("stale");

    const result = await approveAgentActionProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error:
        "The evidence behind this recommendation has changed since it was investigated. Dismiss it and run a fresh investigation instead.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "agent_action_proposal.approval_blocked",
        outcome: "denied",
        metadata: { reason: "evidence_stale" },
      }),
    );
    expect(mockedRecordAgentCollaborationOutcome).not.toHaveBeenCalled();
    expect(mockedCreateInternalTask).not.toHaveBeenCalled();
  });

  it("refuses when a concurrent approve/dismiss already claimed the outcome", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(COLLABORATION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("sufficient");
    mockedRecordAgentCollaborationOutcome.mockResolvedValue(null);

    const result = await approveAgentActionProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This recommendation was already reviewed.",
    });
    expect(mockedCreateInternalTask).not.toHaveBeenCalled();
  });

  it("rolls back the outcome claim when task creation fails, and propagates the real error", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(COLLABORATION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("sufficient");
    mockedRecordAgentCollaborationOutcome.mockResolvedValue({
      id: "collab-1",
    } as never);
    mockedCreateInternalTask.mockRejectedValue(new Error("db write failed"));

    const result = await approveAgentActionProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "db write failed" });
    expect(mockedResetAgentCollaborationOutcome).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
    );
    expect(mockedRecordAuditEvent).not.toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ eventType: "agent_action_proposal.approved" }),
    );
  });

  it("rolls back the outcome claim (but keeps the already-created task) when the audit-event write fails", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(COLLABORATION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("sufficient");
    mockedRecordAgentCollaborationOutcome.mockResolvedValue({
      id: "collab-1",
    } as never);
    mockedCreateInternalTask.mockResolvedValue({
      id: "task-1",
      created: true,
    } as unknown as Awaited<ReturnType<typeof createInternalTask>>);
    mockedRecordAuditEvent.mockRejectedValue(new Error("audit write failed"));

    const result = await approveAgentActionProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "audit write failed" });
    // The task itself is never undone — createInternalTask's idempotency
    // key means a later retry returns the same task rather than
    // duplicating it, which is safer than losing a real business record.
    expect(mockedCreateInternalTask).toHaveBeenCalledTimes(1);
    expect(mockedResetAgentCollaborationOutcome).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
    );
  });

  it("approves cleanly on the happy path: claims the outcome, creates an idempotent task, and records a real audit event", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(COLLABORATION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("sufficient");
    mockedRecordAgentCollaborationOutcome.mockResolvedValue({
      id: "collab-1",
    } as never);
    mockedCreateInternalTask.mockResolvedValue({
      id: "task-1",
      created: true,
    } as unknown as Awaited<ReturnType<typeof createInternalTask>>);
    mockedRecordAuditEvent.mockResolvedValue(undefined);

    const result = await approveAgentActionProposalAction("collab-1");

    expect(result).toEqual({ ok: true, taskId: "task-1", created: true });
    expect(mockedRecordAgentCollaborationOutcome).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      "approved",
    );
    expect(mockedCreateInternalTask).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      expect.objectContaining({
        idempotencyKey: "agent-collaboration:collab-1:create_internal_task",
      }),
    );
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "agent_action_proposal.approved",
        outcome: "allowed",
        metadata: { taskId: "task-1" },
      }),
    );
    expect(mockedResetAgentCollaborationOutcome).not.toHaveBeenCalled();
  });
});
