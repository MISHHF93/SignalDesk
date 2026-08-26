import type * as ApplicationModule from "@signaldesk/application";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
// import time — auto-mocking the whole package breaks that singleton
// (it becomes undefined), which this action's own catch-all error
// path relies on via describeActionError.
vi.mock("@signaldesk/application", async (importOriginal) => {
  const actual = await importOriginal<typeof ApplicationModule>();
  return {
    ...actual,
    composeCards: vi.fn(),
    reconcileSpecialistResults: vi.fn(),
    runParallelSpecialists: vi.fn(),
  };
});
vi.mock("@signaldesk/intelligence");

import {
  composeCards,
  reconcileSpecialistResults,
  runParallelSpecialists,
} from "@signaldesk/application";
import { prioritizeFindings } from "@signaldesk/intelligence";
import {
  completeAgentCollaboration,
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
import { runAgentInvestigationAction } from "./run-agent-investigation";

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
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedRunParallelSpecialists = vi.mocked(runParallelSpecialists);
const mockedReconcileSpecialistResults = vi.mocked(reconcileSpecialistResults);
const mockedPrioritizeFindings = vi.mocked(prioritizeFindings);
const mockedComposeCards = vi.mocked(composeCards);
const mockedCreateAgentGatewayService = vi.mocked(createAgentGatewayService);
const mockedAvailabilityFor = vi.mocked(availabilityFor);
const mockedProviderFor = vi.mocked(providerFor);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
};

const OVERDUE_INVOICE_FINDING = {
  id: "finding-1",
  type: "invoice.overdue",
  freshness: { status: "fresh" },
} as unknown as Awaited<
  ReturnType<typeof getTodaysAttention>
>["findings"][number];

/**
 * Real behavioral coverage for the Agent Fabric's one real AI trigger —
 * every deterministic gate that must fire before any model is ever
 * called (kill switch, rate limit, evidence sufficiency, an advisory
 * lock against a double-submit), plus the two real outcomes of the
 * pipeline it guards (a confident reconciled recommendation vs. an
 * honest abstention). `runParallelSpecialists`/
 * `reconcileSpecialistResults`/`prioritizeFindings`/`composeCards` are
 * mocked directly — each is complex pipeline logic with its own
 * concerns, and this file's job is the gating/orchestration around them,
 * not re-deriving their own internals.
 */
describe("runAgentInvestigationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsAgentFabricEnabled.mockReturnValue(true);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [OVERDUE_INVOICE_FINDING],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);
    mockedClassifyEvidenceSufficiency.mockReturnValue("sufficient");
    mockedWithAdvisoryLock.mockImplementation(async (_db, _key, fn) => fn());
    mockedStartAgentCollaboration.mockResolvedValue({
      id: "collab-1",
    } as Awaited<ReturnType<typeof startAgentCollaboration>>);
    mockedCreateAgentGatewayService.mockReturnValue({
      dispatch: vi.fn(),
    } as unknown as ReturnType<typeof createAgentGatewayService>);
    mockedAvailabilityFor.mockReturnValue(
      {} as ReturnType<typeof availabilityFor>,
    );
    mockedProviderFor.mockReturnValue({} as ReturnType<typeof providerFor>);
    mockedRunParallelSpecialists.mockResolvedValue([]);
    mockedPrioritizeFindings.mockReturnValue(
      [] as ReturnType<typeof prioritizeFindings>,
    );
    mockedComposeCards.mockReturnValue([] as ReturnType<typeof composeCards>);
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await runAgentInvestigationAction(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("declines honestly (not as an error) when the kill switch is off, and records why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedIsAgentFabricEnabled.mockReturnValue(false);

    const result = await runAgentInvestigationAction(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: "AI investigation is not enabled for this organization.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "agent.investigation.declined",
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

    const result = await runAgentInvestigationAction(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: false,
      error: "Please wait 3 more minute(s) before investigating again.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ metadata: { reason: "rate_limited" } }),
    );
    expect(mockedGetTodaysAttention).not.toHaveBeenCalled();
  });

  it("declines honestly when there is no material evidence to investigate at all", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("missing");

    const result = await runAgentInvestigationAction(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: "Nothing to investigate right now.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "no_material_findings" },
      }),
    );
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
  });

  it("declines honestly when the available evidence has gone stale, never reaching the model", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("stale");

    const result = await runAgentInvestigationAction(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message:
        "The evidence behind current findings hasn't refreshed recently enough to investigate confidently right now.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ metadata: { reason: "evidence_stale" } }),
    );
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
  });

  it("declines honestly when another investigation is already running for this workspace", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const result = await runAgentInvestigationAction(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message:
        "An investigation is already running for this workspace. Please wait a moment and try again.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "investigation_already_running" },
      }),
    );
  });

  it("completes the collaboration as failed and returns an honest abstention when the reconciler finds no confident recommendation", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedReconcileSpecialistResults.mockReturnValue({
      finding: null,
      contradictionsDetected: false,
    });

    const result = await runAgentInvestigationAction(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: "No confident recommendation from this investigation.",
    });
    expect(mockedCompleteAgentCollaboration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      expect.objectContaining({
        status: "failed",
        reconciledSummary: null,
        reconciledConfidenceBasisPoints: null,
      }),
    );
  });

  it("completes the collaboration and returns the composed card on a confident reconciled recommendation", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedReconcileSpecialistResults.mockReturnValue({
      finding: {
        summary: "Invoice risk found.",
        confidence: 0.9,
      } as ReturnType<typeof reconcileSpecialistResults>["finding"],
      contradictionsDetected: false,
    });
    const composedCard = { id: "collab-1", type: "agent_recommendation" };
    mockedComposeCards.mockReturnValue([composedCard] as unknown as ReturnType<
      typeof composeCards
    >);

    const result = await runAgentInvestigationAction(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: composedCard,
      message: "Investigation complete.",
    });
    expect(mockedCompleteAgentCollaboration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      expect.objectContaining({
        status: "completed",
        reconciledSummary: "Invoice risk found.",
        reconciledConfidenceBasisPoints: 9000,
      }),
    );
  });

  it("returns a description of the failure when a top-level step throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetTodaysAttention.mockRejectedValue(new Error("db unavailable"));

    const result = await runAgentInvestigationAction(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({ ok: false, error: "db unavailable" });
  });
});
