import { beforeEach, describe, expect, it, vi } from "vitest";

// draftTicketReplyAction is a thin "use server" wrapper around one call to
// the shared, already-thoroughly-tested draftEntityContentAction(config)
// closure (see _lib/draft-entity-content-action.test.ts for the real
// gating/concurrency/rollback behavior every draft-*-action.ts file
// shares). Unlike its QuickBooks/Asana/HubSpot siblings, this file's own
// buildDraftContext is a real, disclosed exception (see the source file's
// doc comment): it does a LIVE read from Zendesk at draft time (comments
// aren't ingested/stored anywhere in this app), gated on the Zendesk
// integration actually being connected. That extra real behavior is worth
// testing directly, not just the wiring.
const mockedDraftEntityContentAction = vi.fn();
const mockedGetSupportTicketById = vi.fn();
const mockedGetZendeskIntegrationStatus = vi.fn();
const mockedFetchZendeskTicketComments = vi.fn();
const mockedEnsureFreshZendeskAccessToken = vi.fn();

vi.mock("../_lib/draft-entity-content-action", () => ({
  draftEntityContentAction: mockedDraftEntityContentAction,
}));
vi.mock("@signaldesk/persistence", () => ({
  getSupportTicketById: mockedGetSupportTicketById,
  getZendeskIntegrationStatus: mockedGetZendeskIntegrationStatus,
}));
vi.mock("@signaldesk/integrations/zendesk", () => ({
  fetchZendeskTicketComments: mockedFetchZendeskTicketComments,
}));
vi.mock("../_lib/sync-zendesk", () => ({
  ensureFreshZendeskAccessToken: mockedEnsureFreshZendeskAccessToken,
}));

describe("draftTicketReplyAction wiring", () => {
  let capturedConfig: Record<string, unknown> | undefined;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    capturedConfig = undefined;
    mockedDraftEntityContentAction.mockImplementation((config) => {
      capturedConfig = config;
      return vi.fn();
    });
    await import("./draft-ticket-reply-action");
  });

  it("configures the shared orchestrator for the ticket.stuck finding and support_ticket entity kind", () => {
    expect(capturedConfig).toMatchObject({
      findingType: "ticket.stuck",
      entityKind: "support_ticket",
      newFindingType: "ticket.reply_drafted",
      actionType: "post_ticket_reply",
      capability: "draft_ticket_reply",
    });
  });

  it("fetches the ticket by id via getSupportTicketById", async () => {
    mockedGetSupportTicketById.mockResolvedValue({ id: "ticket-1" });

    const fetchEntity = capturedConfig?.fetchEntity as (
      db: unknown,
      organizationId: string,
      entityId: string,
    ) => Promise<unknown>;
    const entity = await fetchEntity(undefined, "org-1", "ticket-1");

    expect(mockedGetSupportTicketById).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "ticket-1",
    );
    expect(entity).toEqual({ id: "ticket-1" });
  });

  it("refuses to build a draft context when Zendesk isn't connected at all", async () => {
    mockedGetZendeskIntegrationStatus.mockResolvedValue(null);

    const buildDraftContext = capturedConfig?.buildDraftContext as (
      ticket: unknown,
      finding: unknown,
      db: unknown,
      organizationId: string,
    ) => Promise<unknown>;

    await expect(
      buildDraftContext(
        {
          subject: "Help",
          requesterName: "Sam",
          source: { externalRecordId: "1" },
        },
        { id: "finding-1" },
        undefined,
        "org-1",
      ),
    ).rejects.toThrow("Reconnect Zendesk to draft a reply.");
    expect(mockedFetchZendeskTicketComments).not.toHaveBeenCalled();
  });

  it("refuses when the Zendesk integration is neither active nor degraded", async () => {
    mockedGetZendeskIntegrationStatus.mockResolvedValue({
      id: "integration-1",
      status: "disconnected",
      externalAccountId: "acct-1",
    });

    const buildDraftContext = capturedConfig?.buildDraftContext as (
      ticket: unknown,
      finding: unknown,
      db: unknown,
      organizationId: string,
    ) => Promise<unknown>;

    await expect(
      buildDraftContext(
        {
          subject: "Help",
          requesterName: "Sam",
          source: { externalRecordId: "1" },
        },
        { id: "finding-1" },
        undefined,
        "org-1",
      ),
    ).rejects.toThrow("Reconnect Zendesk to draft a reply.");
  });

  it("fetches a live, bounded window of the ticket's most recent comments and flags truncation honestly", async () => {
    mockedGetZendeskIntegrationStatus.mockResolvedValue({
      id: "integration-1",
      status: "active",
      externalAccountId: "acct-1",
    });
    mockedEnsureFreshZendeskAccessToken.mockResolvedValue("access-token-1");
    mockedFetchZendeskTicketComments.mockResolvedValue([
      "c1",
      "c2",
      "c3",
      "c4",
      "c5",
      "c6",
      "c7",
    ]);

    const buildDraftContext = capturedConfig?.buildDraftContext as (
      ticket: unknown,
      finding: unknown,
      db: unknown,
      organizationId: string,
    ) => Promise<Record<string, unknown>>;

    const context = await buildDraftContext(
      {
        subject: "Can't log in",
        requesterName: "Sam",
        source: { externalRecordId: "42" },
      },
      { id: "finding-1" },
      undefined,
      "org-1",
    );

    expect(mockedEnsureFreshZendeskAccessToken).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "integration-1",
      "acct-1",
    );
    expect(mockedFetchZendeskTicketComments).toHaveBeenCalledWith(
      "access-token-1",
      "acct-1",
      42,
    );
    expect(context).toMatchObject({
      capability: "draft_ticket_reply",
      subject: "Can't log in",
      requesterName: "Sam",
      recentComments: ["c3", "c4", "c5", "c6", "c7"],
      commentsTruncated: true,
    });
  });

  it("reports no truncation when the ticket has 5 or fewer comments", async () => {
    mockedGetZendeskIntegrationStatus.mockResolvedValue({
      id: "integration-1",
      status: "degraded",
      externalAccountId: "acct-1",
    });
    mockedEnsureFreshZendeskAccessToken.mockResolvedValue("access-token-1");
    mockedFetchZendeskTicketComments.mockResolvedValue(["c1", "c2"]);

    const buildDraftContext = capturedConfig?.buildDraftContext as (
      ticket: unknown,
      finding: unknown,
      db: unknown,
      organizationId: string,
    ) => Promise<Record<string, unknown>>;

    const context = await buildDraftContext(
      {
        subject: "Can't log in",
        requesterName: "Sam",
        source: { externalRecordId: "42" },
      },
      { id: "finding-1" },
      undefined,
      "org-1",
    );

    expect(context).toMatchObject({
      recentComments: ["c1", "c2"],
      commentsTruncated: false,
    });
  });
});
