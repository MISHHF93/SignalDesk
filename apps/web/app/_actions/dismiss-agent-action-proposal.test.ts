import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");

import {
  getAgentCollaboration,
  recordAgentCollaborationOutcome,
  recordAuditEvent,
  resetAgentCollaborationOutcome,
} from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { dismissAgentActionProposalAction } from "./dismiss-agent-action-proposal";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetAgentCollaboration = vi.mocked(getAgentCollaboration);
const mockedRecordAgentCollaborationOutcome = vi.mocked(
  recordAgentCollaborationOutcome,
);
const mockedResetAgentCollaborationOutcome = vi.mocked(
  resetAgentCollaborationOutcome,
);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);

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
} as unknown as Awaited<ReturnType<typeof getAgentCollaboration>>;

/**
 * Symmetric coverage to approve-agent-action-proposal.test.ts: this
 * action's own real risk is the same claim-then-write race protection
 * (ADR 0027), not authorization.
 */
describe("dismissAgentActionProposalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early with no session and performs no lookup", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await dismissAgentActionProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedGetAgentCollaboration).not.toHaveBeenCalled();
  });

  it("refuses when the collaboration no longer exists", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(null);

    const result = await dismissAgentActionProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This investigation is no longer available.",
    });
    expect(mockedRecordAgentCollaborationOutcome).not.toHaveBeenCalled();
  });

  it("refuses when a concurrent approve/dismiss already claimed the outcome", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(COLLABORATION);
    mockedRecordAgentCollaborationOutcome.mockResolvedValue(null);

    const result = await dismissAgentActionProposalAction("collab-1");

    expect(result).toEqual({
      ok: false,
      error: "This recommendation was already reviewed.",
    });
    expect(mockedRecordAuditEvent).not.toHaveBeenCalled();
  });

  it("rolls back the outcome claim when the audit-event write fails", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(COLLABORATION);
    mockedRecordAgentCollaborationOutcome.mockResolvedValue({
      id: "collab-1",
    } as never);
    mockedRecordAuditEvent.mockRejectedValue(new Error("audit write failed"));

    const result = await dismissAgentActionProposalAction("collab-1");

    expect(result).toEqual({ ok: false, error: "audit write failed" });
    expect(mockedResetAgentCollaborationOutcome).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
    );
  });

  it("dismisses cleanly on the happy path: claims the outcome and records a denied audit event", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetAgentCollaboration.mockResolvedValue(COLLABORATION);
    mockedRecordAgentCollaborationOutcome.mockResolvedValue({
      id: "collab-1",
    } as never);
    mockedRecordAuditEvent.mockResolvedValue(undefined);

    const result = await dismissAgentActionProposalAction("collab-1");

    expect(result).toEqual({ ok: true });
    expect(mockedRecordAgentCollaborationOutcome).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      "dismissed",
    );
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "agent_action_proposal.dismissed",
        outcome: "denied",
      }),
    );
    expect(mockedResetAgentCollaborationOutcome).not.toHaveBeenCalled();
  });
});
