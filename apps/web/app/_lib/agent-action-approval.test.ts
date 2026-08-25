import { describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");

import {
  recordAgentCollaborationOutcome,
  recordAuditEvent,
  resetAgentCollaborationOutcome,
} from "@signaldesk/persistence";

import {
  claimApprovalOrFail,
  decideCollaborationApprovalPath,
  isFindingStillLive,
  recordApprovalBlocked,
  withApprovalRollback,
} from "./agent-action-approval";

const mockedRecordAgentCollaborationOutcome = vi.mocked(
  recordAgentCollaborationOutcome,
);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedResetAgentCollaborationOutcome = vi.mocked(
  resetAgentCollaborationOutcome,
);

/**
 * These 5 functions are the shared logic every one of the app's 5 real
 * external-write approve actions (Gmail reply, QuickBooks invoice
 * reminder, Asana task nudge, HubSpot deal note, Zendesk ticket reply)
 * depends on — a bug here would silently affect all 5 at once, which is
 * exactly why this file was extracted rather than left duplicated
 * per-connector. Testing it in isolation gives outsized coverage per
 * line versus testing each 400-line connector-specific action file
 * separately for the same shared behavior.
 */
describe("decideCollaborationApprovalPath", () => {
  it("blocks when there is no collaboration at all", () => {
    expect(decideCollaborationApprovalPath(null, "entity-1", true)).toEqual({
      kind: "blocked",
      error: "This recommendation is no longer available.",
    });
  });

  it("blocks when the collaboration has no linked entity id", () => {
    expect(
      decideCollaborationApprovalPath({ outcome: null }, null, true),
    ).toEqual({
      kind: "blocked",
      error: "This recommendation is no longer available.",
    });
  });

  it("blocks when the collaboration has no drafted content", () => {
    expect(
      decideCollaborationApprovalPath({ outcome: null }, "entity-1", false),
    ).toEqual({
      kind: "blocked",
      error: "This recommendation is no longer available.",
    });
  });

  it("blocks an already-dismissed collaboration", () => {
    expect(
      decideCollaborationApprovalPath(
        { outcome: "dismissed" },
        "entity-1",
        true,
      ),
    ).toEqual({
      kind: "blocked",
      error: "This recommendation was already dismissed.",
    });
  });

  it("resumes an already-approved collaboration rather than treating it as fresh", () => {
    expect(
      decideCollaborationApprovalPath(
        { outcome: "approved" },
        "entity-1",
        true,
      ),
    ).toEqual({ kind: "resume" });
  });

  it("treats a never-reviewed collaboration as fresh", () => {
    expect(
      decideCollaborationApprovalPath({ outcome: null }, "entity-1", true),
    ).toEqual({ kind: "fresh" });
  });
});

function makeFinding(overrides: {
  readonly type?: string;
  readonly entityKind?: string;
  readonly entityId?: string;
  readonly noEntity?: boolean;
}) {
  return {
    type: overrides.type ?? "invoice.overdue",
    entity: overrides.noEntity
      ? undefined
      : {
          kind: overrides.entityKind ?? "invoice",
          id: overrides.entityId ?? "invoice-1",
        },
    // Only `type` and `entity` are read by isFindingStillLive; the rest
    // of a real IntelligenceFinding's required fields are irrelevant here.
  } as unknown as Parameters<typeof isFindingStillLive>[0][number];
}

describe("isFindingStillLive", () => {
  it("is true when a finding matches type, entity kind, and entity id", () => {
    const findings = [makeFinding({})];

    expect(
      isFindingStillLive(findings, "invoice.overdue", "invoice", "invoice-1"),
    ).toBe(true);
  });

  it("is false when the finding type doesn't match", () => {
    const findings = [makeFinding({ type: "task.overdue" })];

    expect(
      isFindingStillLive(findings, "invoice.overdue", "invoice", "invoice-1"),
    ).toBe(false);
  });

  it("is false when the entity kind doesn't match", () => {
    const findings = [makeFinding({ entityKind: "task" })];

    expect(
      isFindingStillLive(findings, "invoice.overdue", "invoice", "invoice-1"),
    ).toBe(false);
  });

  it("is false when the entity id doesn't match", () => {
    const findings = [makeFinding({ entityId: "invoice-2" })];

    expect(
      isFindingStillLive(findings, "invoice.overdue", "invoice", "invoice-1"),
    ).toBe(false);
  });

  it("is false when the finding has no entity reference at all", () => {
    const findings = [makeFinding({ noEntity: true })];

    expect(
      isFindingStillLive(findings, "invoice.overdue", "invoice", "invoice-1"),
    ).toBe(false);
  });

  it("is false for an empty findings list", () => {
    expect(
      isFindingStillLive([], "invoice.overdue", "invoice", "invoice-1"),
    ).toBe(false);
  });
});

describe("recordApprovalBlocked", () => {
  it("records a denied audit event with the given reason", async () => {
    await recordApprovalBlocked(
      undefined as never,
      "org-1",
      "user-1",
      "collab-1",
      "evidence_stale",
    );

    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        userId: "user-1",
        eventType: "agent_action_proposal.approval_blocked",
        subjectType: "agent_collaboration",
        subjectId: "collab-1",
        outcome: "denied",
        metadata: { reason: "evidence_stale" },
      }),
    );
  });
});

describe("claimApprovalOrFail", () => {
  it("succeeds and claims the outcome as approved when nothing else has claimed it yet", async () => {
    mockedRecordAgentCollaborationOutcome.mockResolvedValue({
      id: "collab-1",
    } as never);

    const result = await claimApprovalOrFail(
      undefined as never,
      "org-1",
      "collab-1",
    );

    expect(result).toEqual({ ok: true });
    expect(mockedRecordAgentCollaborationOutcome).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      "approved",
    );
  });

  it("fails closed with an honest message when a concurrent claim already won the race", async () => {
    mockedRecordAgentCollaborationOutcome.mockResolvedValue(null);

    const result = await claimApprovalOrFail(
      undefined as never,
      "org-1",
      "collab-1",
    );

    expect(result).toEqual({
      ok: false,
      error: "This recommendation was already reviewed.",
    });
  });
});

describe("withApprovalRollback", () => {
  it("returns the wrapped function's result and never resets the claim on success", async () => {
    const result = await withApprovalRollback(
      undefined as never,
      "org-1",
      "collab-1",
      async () => "sent",
    );

    expect(result).toBe("sent");
    expect(mockedResetAgentCollaborationOutcome).not.toHaveBeenCalled();
  });

  it("resets the claim and rethrows the original error when the wrapped function throws", async () => {
    const failure = new Error("upstream send failed");

    await expect(
      withApprovalRollback(undefined as never, "org-1", "collab-1", () => {
        throw failure;
      }),
    ).rejects.toThrow(failure);

    expect(mockedResetAgentCollaborationOutcome).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
    );
  });
});
