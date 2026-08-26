import type { IntelligenceCard } from "@signaldesk/schemas";
import { describe, expect, it, vi } from "vitest";

import type {
  DraftDealNoteActionResult,
  DraftInvoiceReminderActionResult,
} from "./actions";
import {
  dedupeCardsByEntity,
  dispatchDraftForCard,
  getBatchDraftableCards,
  groupCardsIntoClusters,
  hasDraftActionForEntityKind,
  type DraftActionsByEntityKind,
} from "./card-clustering";

function card(
  overrides: Partial<IntelligenceCard> & { id: string },
): IntelligenceCard {
  return {
    type: "invoice_risk",
    title: "Test card",
    summary: "Test summary",
    priority: 0,
    severity: "medium",
    explanation: { trigger: "Test trigger", confidence: "high" },
    sources: [],
    recommendedActions: [],
    freshness: { asOf: new Date(), status: "fresh" },
    ...overrides,
  };
}

describe("groupCardsIntoClusters", () => {
  it("puts an uncorrelated card in its own singleton cluster", () => {
    const cards = [card({ id: "a" })];
    const clusters = groupCardsIntoClusters(cards);

    expect(clusters).toEqual([{ key: "a", cards: [cards[0]] }]);
  });

  it("groups two cards that reference each other via relatedFindingIds", () => {
    const a = card({ id: "a", relatedFindingIds: ["b"] });
    const b = card({ id: "b", relatedFindingIds: ["a"] });
    const clusters = groupCardsIntoClusters([a, b]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.cards).toEqual([a, b]);
    expect(clusters[0]?.key).toBe("a|b");
  });

  it("never lists the same card twice across clusters, even if referenced twice", () => {
    const a = card({ id: "a", relatedFindingIds: ["b"] });
    const b = card({ id: "b", relatedFindingIds: ["a"] });
    const c = card({ id: "c" });
    const clusters = groupCardsIntoClusters([a, b, c]);

    const allCardIds = clusters.flatMap((cluster) =>
      cluster.cards.map((cardInCluster) => cardInCluster.id),
    );

    expect(allCardIds).toEqual(["a", "b", "c"]);
  });

  it("drops a relatedFindingIds reference to a card that isn't in the current list", () => {
    const a = card({ id: "a", relatedFindingIds: ["missing"] });
    const clusters = groupCardsIntoClusters([a]);

    expect(clusters).toEqual([{ key: "a", cards: [a] }]);
  });

  it("keeps a group's position at its first (highest-ranked) member", () => {
    const high = card({ id: "high", relatedFindingIds: ["low"] });
    const middle = card({ id: "middle" });
    const low = card({ id: "low", relatedFindingIds: ["high"] });
    const clusters = groupCardsIntoClusters([high, middle, low]);

    expect(clusters.map((cluster) => cluster.key)).toEqual([
      "high|low",
      "middle",
    ]);
  });
});

describe("hasDraftActionForEntityKind", () => {
  const actions: DraftActionsByEntityKind = {
    invoice: vi.fn(),
  };

  it("returns true for a wired-in kind", () => {
    expect(hasDraftActionForEntityKind("invoice", actions)).toBe(true);
  });

  it("returns false for a kind with no wired-in action", () => {
    expect(hasDraftActionForEntityKind("task", actions)).toBe(false);
  });

  it("returns false for an entity kind with no draft action at all (e.g. goal)", () => {
    expect(hasDraftActionForEntityKind("goal", actions)).toBe(false);
  });
});

describe("dedupeCardsByEntity", () => {
  it("keeps only the first card per unique entity", () => {
    const a = card({ id: "a", entity: { kind: "lead", id: "lead-1" } });
    const b = card({ id: "b", entity: { kind: "lead", id: "lead-1" } });

    expect(dedupeCardsByEntity([a, b])).toEqual([a]);
  });

  it("keeps cards for different entities of the same kind", () => {
    const a = card({ id: "a", entity: { kind: "lead", id: "lead-1" } });
    const b = card({ id: "b", entity: { kind: "lead", id: "lead-2" } });

    expect(dedupeCardsByEntity([a, b])).toEqual([a, b]);
  });

  it("keeps cards for the same id but different entity kinds", () => {
    const a = card({ id: "a", entity: { kind: "lead", id: "same-id" } });
    const b = card({ id: "b", entity: { kind: "invoice", id: "same-id" } });

    expect(dedupeCardsByEntity([a, b])).toEqual([a, b]);
  });

  it("keeps every card with no entity, since nothing dedupes against it", () => {
    const a = card({ id: "a" });
    const b = card({ id: "b" });

    expect(dedupeCardsByEntity([a, b])).toEqual([a, b]);
  });
});

describe("getBatchDraftableCards", () => {
  it("returns an empty list when fewer than two distinct entities are draftable", () => {
    const actions: DraftActionsByEntityKind = { invoice: vi.fn() };
    const cards = [
      card({ id: "a", entity: { kind: "invoice", id: "inv-1" } }),
      card({ id: "b", entity: { kind: "task", id: "task-1" } }),
    ];

    expect(getBatchDraftableCards(cards, actions)).toHaveLength(1);
  });

  it("returns both cards when two distinct entities are draftable", () => {
    const actions: DraftActionsByEntityKind = {
      invoice: vi.fn(),
      lead: vi.fn(),
    };
    const a = card({ id: "a", entity: { kind: "invoice", id: "inv-1" } });
    const b = card({ id: "b", entity: { kind: "lead", id: "lead-1" } });

    expect(getBatchDraftableCards([a, b], actions)).toEqual([a, b]);
  });

  it("collapses two findings on the same entity to one draftable card (the duplicate-draft bug found live-verifying ADR 0060)", () => {
    const actions: DraftActionsByEntityKind = { lead: vi.fn() };
    const followUpRisk = card({
      id: "a",
      type: "lead_risk",
      entity: { kind: "lead", id: "lead-1" },
    });
    const ownershipGap = card({
      id: "b",
      type: "ownership_gap",
      entity: { kind: "lead", id: "lead-1" },
    });

    const result = getBatchDraftableCards(
      [followUpRisk, ownershipGap],
      actions,
    );

    expect(result).toEqual([followUpRisk]);
  });
});

describe("dispatchDraftForCard", () => {
  it("returns null for a card with no entity", async () => {
    const result = await dispatchDraftForCard(card({ id: "a" }), {});

    expect(result).toBeNull();
  });

  it("returns null when no draft action is wired in for the card's entity kind", async () => {
    const result = await dispatchDraftForCard(
      card({ id: "a", entity: { kind: "task", id: "task-1" } }),
      {},
    );

    expect(result).toBeNull();
  });

  it("calls the matching action with the entity id and returns its result", async () => {
    const okResult: DraftInvoiceReminderActionResult = {
      ok: true,
      card: null,
      message: "Drafted.",
    };
    const draftInvoiceReminderAction = vi.fn().mockResolvedValue(okResult);
    const result = await dispatchDraftForCard(
      card({ id: "a", entity: { kind: "invoice", id: "inv-1" } }),
      { invoice: draftInvoiceReminderAction },
    );

    // The second argument is a real draft id `dispatchDraftForCard` itself
    // generates per dispatch (docs/adr/0063-agent-investigation-progress.md)
    // — a fresh UUID every call, so this only asserts its shape, not an
    // exact value.
    expect(draftInvoiceReminderAction).toHaveBeenCalledWith(
      "inv-1",
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ),
    );
    expect(result).toBe(okResult);
  });

  it("routes a lead entity to the deal-note action", async () => {
    const okResult: DraftDealNoteActionResult = {
      ok: true,
      card: null,
      message: "Drafted.",
    };
    const draftDealNoteAction = vi.fn().mockResolvedValue(okResult);
    const result = await dispatchDraftForCard(
      card({ id: "a", entity: { kind: "lead", id: "lead-1" } }),
      { lead: draftDealNoteAction },
    );

    expect(draftDealNoteAction).toHaveBeenCalledWith(
      "lead-1",
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ),
    );
    expect(result).toBe(okResult);
  });
});
