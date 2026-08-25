import type { EntityReference, IntelligenceCard } from "@signaldesk/schemas";

import type {
  DraftDealNoteAction,
  DraftEntityContentActionResult,
  DraftInvoiceReminderAction,
  DraftMessageReplyAction,
  DraftTaskNudgeAction,
  DraftTicketReplyAction,
} from "./actions";

/**
 * One cluster of cards to render adjacently — either a real correlated
 * group (`relatedFindingIds`, `correlateFindingsByName` in
 * `@signaldesk/intelligence`) or a single unrelated card. Built purely
 * from data already on each `IntelligenceCard`; no new detection logic,
 * no merge — every member is still rendered as its own fully independent
 * card via `renderCard`, exactly the "hint, never a merge" guarantee
 * `correlateFindingsByName`'s own doc comment establishes. A group's
 * position in the returned list is wherever its first (i.e.
 * highest-ranked, since `cards` already arrives severity-ordered) member
 * would have appeared alone — grouping never promotes a lower-priority
 * cluster above a higher-priority single card.
 */
export interface CardCluster {
  readonly key: string;
  readonly cards: readonly IntelligenceCard[];
}

export function groupCardsIntoClusters(
  cards: readonly IntelligenceCard[],
): readonly CardCluster[] {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const consumed = new Set<string>();
  const clusters: CardCluster[] = [];

  for (const card of cards) {
    if (consumed.has(card.id)) {
      continue;
    }

    const memberIds = [card.id, ...(card.relatedFindingIds ?? [])].filter(
      (id) => cardById.has(id) && !consumed.has(id),
    );

    for (const id of memberIds) {
      consumed.add(id);
    }

    clusters.push({
      key: memberIds.slice().sort().join("|"),
      cards: memberIds.map((id) => cardById.get(id)!),
    });
  }

  return clusters;
}

/** The one draft action bundle `dispatchDraftForCard` picks from, by the
 * card's own `entity.kind` — mirrors `renderCard`'s existing per-kind
 * prop threading, not a new mechanism. */
export interface DraftActionsByEntityKind {
  readonly message?: DraftMessageReplyAction;
  readonly invoice?: DraftInvoiceReminderAction;
  readonly task?: DraftTaskNudgeAction;
  readonly lead?: DraftDealNoteAction;
  readonly support_ticket?: DraftTicketReplyAction;
}

/**
 * A "draft for this Matter" batch trigger fires the exact same, already-
 * real single-entity draft action a card's own button would — one call
 * per grouped card, still landing each result as its own independent
 * `agent_recommendation` card a human reviews and approves individually.
 * No new write path, no auto-approval, no auto-send: this only saves the
 * operator from clicking "Draft" once per related card in a Matter.
 * `null` when this card's entity kind has no draft action wired in for
 * this deployment, or no `entity` at all (an agent_recommendation card,
 * which never appears inside a Matter cluster in the first place — see
 * `groupCardsIntoClusters`'s own doc comment).
 */
export async function dispatchDraftForCard(
  card: IntelligenceCard,
  actions: DraftActionsByEntityKind,
): Promise<DraftEntityContentActionResult | null> {
  if (!card.entity) {
    return null;
  }

  switch (card.entity.kind) {
    case "message":
      return actions.message ? actions.message(card.entity.id) : null;
    case "invoice":
      return actions.invoice ? actions.invoice(card.entity.id) : null;
    case "task":
      return actions.task ? actions.task(card.entity.id) : null;
    case "lead":
      return actions.lead ? actions.lead(card.entity.id) : null;
    case "support_ticket":
      return actions.support_ticket
        ? actions.support_ticket(card.entity.id)
        : null;
    default:
      return null;
  }
}

export function hasDraftActionForEntityKind(
  kind: EntityReference["kind"],
  actions: DraftActionsByEntityKind,
): boolean {
  switch (kind) {
    case "message":
      return actions.message !== undefined;
    case "invoice":
      return actions.invoice !== undefined;
    case "task":
      return actions.task !== undefined;
    case "lead":
      return actions.lead !== undefined;
    case "support_ticket":
      return actions.support_ticket !== undefined;
    default:
      return false;
  }
}

/**
 * Keeps only the first card per unique real entity (`kind:id`) — a Matter
 * can legitimately group two different findings on the exact same entity
 * (e.g. a lead with both a `follow_up_risk` and an `ownership_gap`
 * finding, both correlating on the same company name), and dispatching a
 * draft once per *card* rather than once per *entity* would fire the same
 * draft action twice for the same underlying record, producing two
 * near-duplicate drafts a human then has to notice and dismiss one of
 * (found live-verifying ADR 0060 against a real seeded Matter). A card
 * with no `entity` is kept as-is — there is nothing to dedupe it against.
 */
export function dedupeCardsByEntity(
  cards: readonly IntelligenceCard[],
): readonly IntelligenceCard[] {
  const seenEntityKeys = new Set<string>();
  const deduped: IntelligenceCard[] = [];

  for (const card of cards) {
    if (!card.entity) {
      deduped.push(card);
      continue;
    }

    const entityKey = `${card.entity.kind}:${card.entity.id}`;

    if (seenEntityKeys.has(entityKey)) {
      continue;
    }

    seenEntityKeys.add(entityKey);
    deduped.push(card);
  }

  return deduped;
}

/**
 * The real, deduped set of cards a "Draft for this Matter" batch trigger
 * would actually dispatch a draft for — one card per unique entity
 * (`dedupeCardsByEntity`), filtered to entities with a real, wired-in
 * draft action. The single source of truth for whether to show the batch
 * button (2 or more entries), what number to put on it, and what to
 * actually dispatch when it's clicked — one call, so those three can never
 * silently disagree.
 */
export function getBatchDraftableCards(
  cards: readonly IntelligenceCard[],
  actions: DraftActionsByEntityKind,
): readonly IntelligenceCard[] {
  return dedupeCardsByEntity(cards).filter(
    (card) =>
      card.entity && hasDraftActionForEntityKind(card.entity.kind, actions),
  );
}
