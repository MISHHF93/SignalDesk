import type {
  AgentCard,
  AgentTask,
  SpecialistInterpretation,
} from "@signaldesk/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/persistence");

import {
  assertGrantActive,
  insertAgentTaskResultWithClient,
  insertAuditEvent,
  mintCapabilityGrant,
  recordInternalCostEventWithClient,
  withTenantContext,
} from "@signaldesk/persistence";

import { createAgentGatewayService } from "./agent-gateway";

const mockedWithTenantContext = vi.mocked(withTenantContext);
const mockedMintCapabilityGrant = vi.mocked(mintCapabilityGrant);
const mockedAssertGrantActive = vi.mocked(assertGrantActive);
const mockedInsertAgentTaskResultWithClient = vi.mocked(
  insertAgentTaskResultWithClient,
);
const mockedRecordInternalCostEventWithClient = vi.mocked(
  recordInternalCostEventWithClient,
);
const mockedInsertAuditEvent = vi.mocked(insertAuditEvent);

const FAKE_CLIENT = { query: vi.fn() } as never;

const AGENT: AgentCard = {
  id: "specialist-1",
  provider: "anthropic",
  displayName: "Specialist",
  description: "A test specialist.",
  capabilities: ["draft_deal_note"],
  dataAccess: ["lead_findings"],
  riskLevel: "low",
  canRead: true,
  canPropose: true,
  canExecute: false,
  requiresApproval: true,
  costPerTaskUsdMicros: 0,
  timeBudgetMs: 5000,
};

const TASK: AgentTask = {
  id: "task-1",
  objective: "Summarize this deal.",
  requestedCapability: "draft_deal_note",
  contextRefs: [
    {
      integrationId: "integration-1",
      system: "hubspot",
      externalRecordId: "deal-1",
      sourceVersion: "1",
      recordDigestSha256: "a".repeat(64),
      lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  ],
  constraints: { maxFindings: 10, mustNotInventFacts: true },
};

const FINDINGS = [{ id: "finding-1" }] as never;

const INTERPRETATION: SpecialistInterpretation = {
  claims: ["The deal has gone quiet."],
  confidence: 0.8,
};

/**
 * Real behavioral coverage for the Agent Fabric trust boundary's core
 * write path, which had no dedicated test file before. Focused on
 * recordOutcome's atomicity fix: the task result, cost event, and audit
 * event used to each open their own independent transaction, so a
 * transient failure on the last of the three could leave the first two
 * committed while the caller's own catch-and-retry then wrote a second,
 * contradictory pair on top.
 */
describe("createAgentGatewayService — dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWithTenantContext.mockImplementation((_pool, _orgId, fn) =>
      fn(FAKE_CLIENT),
    );
    mockedMintCapabilityGrant.mockResolvedValue({
      id: "grant-1",
      collaborationId: "collab-1",
      agentId: AGENT.id,
      capability: TASK.requestedCapability,
      canRead: true,
      canPropose: true,
      canExecute: false,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    mockedAssertGrantActive.mockReturnValue(undefined);
    mockedInsertAuditEvent.mockResolvedValue(undefined);
  });

  function makeService(
    providerFor: () => Promise<{
      generateStructured: ReturnType<typeof vi.fn>;
    }>,
  ) {
    return createAgentGatewayService({
      pool: undefined as never,
      organizationId: "org-1",
      collaborationId: "collab-1",
      providerFor: providerFor as never,
    });
  }

  it("regression: records the task result, cost event, and audit event within one withTenantContext transaction, not three independent ones", async () => {
    const generateStructured = vi.fn().mockResolvedValue(INTERPRETATION);
    const service = makeService(async () => ({ generateStructured }));

    await service.dispatch(TASK, AGENT, FINDINGS);

    expect(mockedWithTenantContext).toHaveBeenCalledTimes(1);
    expect(mockedInsertAgentTaskResultWithClient).toHaveBeenCalledWith(
      FAKE_CLIENT,
      "org-1",
      expect.objectContaining({ status: "completed" }),
    );
    expect(mockedRecordInternalCostEventWithClient).toHaveBeenCalledWith(
      FAKE_CLIENT,
      "org-1",
      expect.objectContaining({ eventType: "claude_specialist_invocation" }),
    );
    expect(mockedInsertAuditEvent).toHaveBeenCalledWith(
      FAKE_CLIENT,
      "org-1",
      expect.objectContaining({ outcome: "succeeded" }),
    );
  });

  it("does not record a cost event for a deterministic-provider agent, even on success", async () => {
    const generateStructured = vi.fn().mockResolvedValue(INTERPRETATION);
    const service = makeService(async () => ({ generateStructured }));

    await service.dispatch(
      TASK,
      { ...AGENT, provider: "deterministic" },
      FINDINGS,
    );

    expect(mockedRecordInternalCostEventWithClient).not.toHaveBeenCalled();
  });

  it("regression: real bug found by review — a failure recording the audit event no longer leaves a partial task result and cost event committed for the retry to double up on", async () => {
    const generateStructured = vi.fn().mockResolvedValue(INTERPRETATION);
    const service = makeService(async () => ({ generateStructured }));

    // The first (success-path) recordOutcome call's audit-event write
    // throws — simulating a transient DB failure on the last of its
    // three writes.
    mockedInsertAuditEvent.mockRejectedValueOnce(
      new Error("audit_events insert timed out"),
    );

    await expect(service.dispatch(TASK, AGENT, FINDINGS)).rejects.toThrow(
      "audit_events insert timed out",
    );

    // Real, currently-passing assertion this fix guarantees: because both
    // the failed "completed" attempt and the caught-and-retried "failed"
    // attempt each run inside their own single withTenantContext call
    // (never partially committing), withTenantContext is invoked exactly
    // twice — once per full attempt — with no interleaved partial state
    // between them.
    expect(mockedWithTenantContext).toHaveBeenCalledTimes(2);
    expect(mockedInsertAgentTaskResultWithClient).toHaveBeenCalledTimes(2);
    expect(mockedInsertAgentTaskResultWithClient).toHaveBeenNthCalledWith(
      1,
      FAKE_CLIENT,
      "org-1",
      expect.objectContaining({ status: "completed" }),
    );
    expect(mockedInsertAgentTaskResultWithClient).toHaveBeenNthCalledWith(
      2,
      FAKE_CLIENT,
      "org-1",
      expect.objectContaining({ status: "failed" }),
    );
    // The final, real audit trail is the second (retried) call's —
    // 'failed', truthfully reflecting that this attempt-cycle never
    // durably committed a success, rather than a contradictory mix of a
    // committed 'completed' task result alongside a 'failed' audit event.
    expect(mockedInsertAuditEvent).toHaveBeenLastCalledWith(
      FAKE_CLIENT,
      "org-1",
      expect.objectContaining({ outcome: "failed" }),
    );
  });

  it("rejects a capability the agent never declared before ever calling the provider", async () => {
    const generateStructured = vi.fn();
    const service = makeService(async () => ({ generateStructured }));

    await expect(
      service.dispatch(
        { ...TASK, requestedCapability: "draft_ticket_reply" },
        AGENT,
        FINDINGS,
      ),
    ).rejects.toThrow(/not authorized for capability/);

    expect(generateStructured).not.toHaveBeenCalled();
    expect(mockedInsertAgentTaskResultWithClient).toHaveBeenCalledWith(
      FAKE_CLIENT,
      "org-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(mockedInsertAuditEvent).toHaveBeenCalledWith(
      FAKE_CLIENT,
      "org-1",
      expect.objectContaining({ outcome: "denied" }),
    );
    // Never attempted the provider, so no cost event either — a denial
    // must never be misrepresented as an incurred cost.
    expect(mockedRecordInternalCostEventWithClient).not.toHaveBeenCalled();
  });
});

describe("createAgentGatewayService — dispatchContentDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWithTenantContext.mockImplementation((_pool, _orgId, fn) =>
      fn(FAKE_CLIENT),
    );
    mockedMintCapabilityGrant.mockResolvedValue({
      id: "grant-1",
      collaborationId: "collab-1",
      agentId: AGENT.id,
      capability: TASK.requestedCapability,
      canRead: true,
      canPropose: true,
      canExecute: false,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    mockedAssertGrantActive.mockReturnValue(undefined);
    mockedInsertAuditEvent.mockResolvedValue(undefined);
  });

  const DEAL_NOTE_CONTEXT = {
    capability: "draft_deal_note" as const,
    finding: { id: "finding-1" } as never,
    contactName: "Jane Client",
    companyName: "Acme Co",
    stage: "negotiation",
    valueCents: 500_000,
    currency: "USD",
    lastInteractionAt: null,
  };

  function makeDraftService(
    providerFor: () => Promise<{
      generateStructured: ReturnType<typeof vi.fn>;
    }>,
  ) {
    return createAgentGatewayService({
      pool: undefined as never,
      organizationId: "org-1",
      collaborationId: "collab-1",
      providerFor: providerFor as never,
    });
  }

  it("dispatches when context.capability matches task.requestedCapability", async () => {
    const generateStructured = vi.fn().mockResolvedValue({ body: "Note." });
    const service = makeDraftService(async () => ({ generateStructured }));

    const result = await service.dispatchContentDraft(
      TASK,
      AGENT,
      FINDINGS,
      DEAL_NOTE_CONTEXT,
    );

    expect(result.draftedContent).toEqual({ body: "Note." });
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ task: "draft_deal_note" }),
    );
  });

  it("regression: real gap found by review — refuses to dispatch when context.capability doesn't match task.requestedCapability, rather than silently running the mismatched capability under the authorized/audited name", async () => {
    const generateStructured = vi.fn();
    const service = makeDraftService(async () => ({ generateStructured }));

    await expect(
      service.dispatchContentDraft(TASK, AGENT, FINDINGS, {
        ...DEAL_NOTE_CONTEXT,
        capability: "draft_ticket_reply" as never,
      }),
    ).rejects.toThrow(/context\.capability.*does not match/);

    // Never even reached authorization/the provider — this is a
    // caller-contract violation, not a policy question.
    expect(generateStructured).not.toHaveBeenCalled();
    expect(mockedMintCapabilityGrant).not.toHaveBeenCalled();
    expect(mockedInsertAgentTaskResultWithClient).toHaveBeenCalledWith(
      FAKE_CLIENT,
      "org-1",
      expect.objectContaining({ status: "failed" }),
    );
  });
});
