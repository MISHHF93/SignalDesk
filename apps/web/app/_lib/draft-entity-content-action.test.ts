import type * as ApplicationModule from "@signaldesk/application";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./session");
vi.mock("./todays-attention");
vi.mock("./evidence-sufficiency");
vi.mock("./rate-limit");
vi.mock("./agent-config");
vi.mock("./agent-fabric");
vi.mock("./agent-gateway");
vi.mock("@signaldesk/persistence");
// Partial mock: @signaldesk/application also exports
// createConsoleErrorReporter, which the app-side errorReporter singleton
// depends on at import time (see run-agent-investigation.test.ts's
// identical note) — a wholesale mock breaks describeActionError's own
// catch-all path.
vi.mock("@signaldesk/application", async (importOriginal) => {
  const actual = await importOriginal<typeof ApplicationModule>();
  return {
    ...actual,
    composeCards: vi.fn(),
    draftContent: vi.fn(),
  };
});
vi.mock("@signaldesk/intelligence");

import { composeCards, draftContent } from "@signaldesk/application";
import { prioritizeFindings } from "@signaldesk/intelligence";
import {
  completeAgentCollaboration,
  recordAuditEvent,
  startAgentCollaboration,
  withAdvisoryLock,
} from "@signaldesk/persistence";

import { isAgentFabricEnabled } from "./agent-config";
import { availabilityFor, providerFor } from "./agent-fabric";
import { createAgentGatewayService } from "./agent-gateway";
import {
  draftEntityContentAction,
  type DraftEntityContentConfig,
} from "./draft-entity-content-action";
import { classifyEvidenceSufficiency } from "./evidence-sufficiency";
import { checkRateLimit } from "./rate-limit";
import { getCurrentOrganization } from "./session";
import { getTodaysAttention } from "./todays-attention";

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
const mockedDraftContent = vi.mocked(draftContent);
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

const LIVE_FINDING = {
  id: "finding-1",
  type: "invoice.overdue",
  entity: { kind: "invoice", id: "invoice-1" },
  freshness: { status: "fresh" },
} as unknown as Awaited<
  ReturnType<typeof getTodaysAttention>
>["findings"][number];

const mockedFetchEntity = vi.fn();
const mockedBuildDraftContext = vi.fn();

const testConfig = {
  findingType: "invoice.overdue",
  entityKind: "invoice",
  newFindingType: "invoice.reminder_drafted",
  actionType: "send_invoice_reminder",
  capability: "draft_invoice_reminder",
  objective: "Draft a payment-reminder email for this overdue invoice.",
  keyPrefix: "invoice-reminder-draft",
  declinedEventType: "invoice_reminder_draft.declined",
  notFoundMessage: "This invoice is no longer overdue.",
  staleEvidenceMessage: "Evidence is stale.",
  loadFailedMessage: "Could not load this invoice.",
  draftedMessage: "Reminder drafted.",
  draftFailedMessage: "Couldn't draft a reminder right now.",
  draftingStepLabel: "Drafting invoice reminder…",
  fetchEntity: mockedFetchEntity,
  buildDraftContext: mockedBuildDraftContext,
  collaborationEntityRef: (invoiceId: string) => ({ invoiceId }),
} as unknown as DraftEntityContentConfig<
  unknown,
  { capability: "draft_invoice_reminder" }
>;

/**
 * `draftEntityContentAction` is the shared, fully-generalized orchestrator
 * every one of the app's 5 draft-*-action.ts files is a thin config-only
 * wrapper around (drafting has no external side effect, unlike the
 * approve half — see this file's own doc comment for why that's safe to
 * generalize fully here but not there). Testing it once here gives real
 * coverage for all 5 connectors' drafting paths; each connector's own
 * thin wrapper file only needs a smoke test confirming its config is
 * wired correctly, not a re-derivation of this gating logic.
 */
describe("draftEntityContentAction", () => {
  let draft: ReturnType<typeof draftEntityContentAction>;

  beforeEach(() => {
    vi.clearAllMocks();
    draft = draftEntityContentAction(testConfig);
    mockedIsAgentFabricEnabled.mockReturnValue(true);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [LIVE_FINDING],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);
    mockedClassifyEvidenceSufficiency.mockReturnValue("sufficient");
    mockedWithAdvisoryLock.mockImplementation(async (_db, _key, fn) => fn());
    mockedStartAgentCollaboration.mockResolvedValue({
      id: "collab-1",
    } as Awaited<ReturnType<typeof startAgentCollaboration>>);
    mockedFetchEntity.mockResolvedValue({ id: "invoice-1" });
    mockedBuildDraftContext.mockResolvedValue({
      capability: "draft_invoice_reminder",
    });
    mockedCreateAgentGatewayService.mockReturnValue({
      dispatchContentDraft: vi.fn(),
    } as unknown as ReturnType<typeof createAgentGatewayService>);
    mockedAvailabilityFor.mockReturnValue(
      {} as ReturnType<typeof availabilityFor>,
    );
    mockedProviderFor.mockReturnValue({} as ReturnType<typeof providerFor>);
    mockedDraftContent.mockResolvedValue({
      status: "completed",
      confidence: 0.8,
      draftedContent: { body: "Draft body." },
    } as Awaited<ReturnType<typeof draftContent>>);
    mockedPrioritizeFindings.mockReturnValue(
      [] as ReturnType<typeof prioritizeFindings>,
    );
    mockedComposeCards.mockReturnValue([] as ReturnType<typeof composeCards>);
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("declines honestly when the kill switch is off, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedIsAgentFabricEnabled.mockReturnValue(false);

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: "AI drafting is not enabled for this organization.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        metadata: { reason: "agent_fabric_disabled" },
      }),
    );
  });

  it("refuses at the rate limit, recording why", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 125,
    });

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: false,
      error: "Please wait 3 more minute(s) before drafting another one.",
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ metadata: { reason: "rate_limited" } }),
    );
  });

  it("declines honestly when the entity is no longer flagged by the matching finding", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: testConfig.notFoundMessage,
    });
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
  });

  it("declines honestly when the evidence has gone stale", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedClassifyEvidenceSufficiency.mockReturnValue("stale");

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: testConfig.staleEvidenceMessage,
    });
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();
  });

  it("declines honestly when another draft is already being prepared for this entity", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message:
        "A draft is already being prepared for this. Please wait a moment and try again.",
    });
  });

  it("completes the collaboration as failed and returns honestly when the entity can no longer be loaded", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedFetchEntity.mockResolvedValue(null);

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: testConfig.loadFailedMessage,
    });
    expect(mockedCompleteAgentCollaboration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(mockedDraftContent).not.toHaveBeenCalled();
  });

  it("completes the collaboration as failed and returns a real error when building the draft context throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedBuildDraftContext.mockRejectedValue(
      new Error("no stored token for this connector"),
    );

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: false,
      error: "no stored token for this connector",
    });
    expect(mockedCompleteAgentCollaboration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("completes the collaboration as failed and returns honestly when the specialist produces no drafted content", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedDraftContent.mockResolvedValue({
      status: "failed",
      confidence: 0,
      draftedContent: null,
    } as unknown as Awaited<ReturnType<typeof draftContent>>);

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: null,
      message: testConfig.draftFailedMessage,
    });
    expect(mockedCompleteAgentCollaboration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("completes the collaboration and returns the composed card on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    const composedCard = { id: "collab-1", type: "agent_recommendation" };
    mockedComposeCards.mockReturnValue([composedCard] as unknown as ReturnType<
      typeof composeCards
    >);

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({
      ok: true,
      card: composedCard,
      message: testConfig.draftedMessage,
    });
    expect(mockedCompleteAgentCollaboration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "collab-1",
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("returns a description of the failure when a top-level step throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetTodaysAttention.mockRejectedValue(new Error("db unavailable"));

    const result = await draft(
      "invoice-1",
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual({ ok: false, error: "db unavailable" });
  });
});
