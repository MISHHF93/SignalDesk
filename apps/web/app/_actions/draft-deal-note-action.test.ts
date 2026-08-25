import { beforeEach, describe, expect, it, vi } from "vitest";

// draftDealNoteAction is a thin "use server" wrapper around one call to
// the shared, already-thoroughly-tested draftEntityContentAction(config)
// closure (see _lib/draft-entity-content-action.test.ts for the real
// gating/concurrency/rollback behavior every draft-*-action.ts file
// shares). This file's only real job is wiring: does it fetch the right
// entity type, and does it build a context object with the fields
// DealNoteDraftContext actually needs? Mocking draftEntityContentAction
// itself and asserting on the config it's called with is more honest than
// re-driving the whole gate pipeline again here.
const mockedDraftEntityContentAction = vi.fn();
const mockedGetLeadById = vi.fn();

vi.mock("../_lib/draft-entity-content-action", () => ({
  draftEntityContentAction: mockedDraftEntityContentAction,
}));
vi.mock("@signaldesk/persistence", () => ({
  getLeadById: mockedGetLeadById,
}));

describe("draftDealNoteAction wiring", () => {
  let capturedConfig: Record<string, unknown> | undefined;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    capturedConfig = undefined;
    mockedDraftEntityContentAction.mockImplementation((config) => {
      capturedConfig = config;
      return vi.fn();
    });
    await import("./draft-deal-note-action");
  });

  it("configures the shared orchestrator for the lead.follow_up_risk finding and lead entity kind", () => {
    expect(capturedConfig).toMatchObject({
      findingType: "lead.follow_up_risk",
      entityKind: "lead",
      newFindingType: "lead.note_drafted",
      actionType: "post_deal_note",
      capability: "draft_deal_note",
    });
  });

  it("fetches the lead by id via getLeadById", async () => {
    mockedGetLeadById.mockResolvedValue({ id: "lead-1" });

    const fetchEntity = capturedConfig?.fetchEntity as (
      db: unknown,
      organizationId: string,
      entityId: string,
    ) => Promise<unknown>;
    const entity = await fetchEntity(undefined, "org-1", "lead-1");

    expect(mockedGetLeadById).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "lead-1",
    );
    expect(entity).toEqual({ id: "lead-1" });
  });

  it("builds a draft context carrying the lead's real deal fields, never a fabricated figure", () => {
    const buildDraftContext = capturedConfig?.buildDraftContext as (
      lead: unknown,
      finding: unknown,
    ) => Record<string, unknown>;
    const lastInteractionAt = new Date("2026-08-01T00:00:00Z");

    const context = buildDraftContext(
      {
        contactName: "Jane Doe",
        companyName: "Acme Co.",
        stage: "negotiation",
        valueCents: 250_000,
        currency: "USD",
        lastInteractionAt,
        source: { system: "hubspot" },
      },
      { id: "finding-1" },
    );

    expect(context).toMatchObject({
      capability: "draft_deal_note",
      contactName: "Jane Doe",
      companyName: "Acme Co.",
      stage: "negotiation",
      valueCents: 250_000,
      currency: "USD",
      lastInteractionAt,
    });
  });

  it("regression: real gap found by review — refuses to draft a note for a deal not sourced from HubSpot, since only HubSpot can actually log it", () => {
    // leads is a shared table (HubSpot and Salesforce both ingest into
    // it), but only the HubSpot note-create path exists — a
    // Salesforce-sourced deal used to be drafted the same as any other and
    // would only fail (or worse, attach the wrong integration's access
    // token) once approval tried to actually log it through HubSpot.
    const buildDraftContext = capturedConfig?.buildDraftContext as (
      lead: unknown,
      finding: unknown,
    ) => Record<string, unknown>;

    expect(() =>
      buildDraftContext(
        {
          contactName: "Jane Doe",
          companyName: "Acme Co.",
          stage: "negotiation",
          valueCents: 250_000,
          currency: "USD",
          lastInteractionAt: new Date(),
          source: { system: "salesforce" },
        },
        { id: "finding-1" },
      ),
    ).toThrow(/can currently only be logged through HubSpot/);
  });
});
