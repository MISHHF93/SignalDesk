"use client";

import type { FilterDefinition, IntelligenceCard } from "@signaldesk/schemas";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type {
  ApproveAgentActionProposalAction,
  CreateInternalTaskAction,
  DismissAgentActionProposalAction,
  ParseCommandAction,
  RecordCardFeedbackAction,
  RunAgentInvestigationAction,
  SimulateInvoicePaymentAction,
} from "../_lib/actions";
import { buildTaskTitle } from "../_lib/task-title";
import {
  useBusinessSnapshot,
  type SnapshotCard,
} from "../_lib/use-business-snapshot";
import { formatRelativeTime } from "../_cards/format";
import { renderCard } from "../_cards/registry";
import { Button } from "./button";
import { CommandBar } from "./command-bar";
import { RecentActivityPanel } from "./recent-activity-panel";

// Live UI (Phase 2 of the implementation roadmap): a plain interval, not
// WebSocket/SSE — the cheapest real prerequisite, reusing the existing
// rate-limited `/api/business/snapshot` route (30 req/min) rather than a
// new transport. None of the 8 registered deterministic capabilities call
// any AI provider, so a poll tick costs a database read, not an LLM call.
const POLL_INTERVAL_MS = 45_000;

/**
 * `useBusinessSnapshot` returns cards with every `Date` field serialized
 * to a JSON string (`BusinessSnapshotJSON`, the real shape a `fetch` of
 * `/api/business/snapshot` actually receives) — this restores the two
 * real `Date` fields `IntelligenceCard` has
 * (`freshness.asOf`, `sources[].lastSyncedAt`) so a polled card is a
 * genuine `IntelligenceCard`, not a lookalike that breaks the first time
 * something (e.g. `WhyDisclosure`'s relative-time formatting) calls a
 * `Date` method on it.
 */
function reviveCard(card: SnapshotCard): IntelligenceCard {
  return {
    ...card,
    sources: card.sources.map((source) => ({
      ...source,
      lastSyncedAt: new Date(source.lastSyncedAt),
    })),
    freshness: {
      ...card.freshness,
      asOf: new Date(card.freshness.asOf),
    },
    // `intelligenceCardSchema` infers `recommendedActions`/
    // `relatedFindingIds` as plain (mutable) arrays; the generic JSON-
    // revival mapped type makes every array `readonly`. Real values are
    // identical either way — this is just satisfying the schema-inferred
    // type's own shape. Assigned directly (not a conditional spread) since
    // a conditional spread's inferred type keeps the earlier `...card`
    // spread's `readonly` variant in the union even when this branch
    // would otherwise override it.
    recommendedActions: [...card.recommendedActions],
    relatedFindingIds: card.relatedFindingIds
      ? [...card.relatedFindingIds]
      : undefined,
  };
}

function matchesFilter(
  card: IntelligenceCard,
  filter: FilterDefinition,
): boolean {
  if (filter.field === "financialAmount") {
    const amountCents = card.financialContext?.amountCents ?? 0;
    const thresholdDollars =
      typeof filter.value === "number" ? filter.value : Number(filter.value);
    // Every other dollar->cents conversion in this codebase rounds
    // (connector mappers, update-business-profile.ts) — this one didn't,
    // so float imprecision (e.g. 0.55 * 100 === 55.00000000000001) could
    // silently exclude a card sitting exactly on the typed threshold from
    // a "show items over $X" filter (found by a deep audit, 2026-08-22).
    const thresholdCents = Math.round(thresholdDollars * 100);

    return filter.operator === "gte"
      ? amountCents >= thresholdCents
      : amountCents === thresholdCents;
  }

  if (filter.field === "severity") {
    return filter.operator === "eq" ? card.severity === filter.value : true;
  }

  if (filter.field === "text") {
    // Business Search's real deterministic match (Prompt 31,
    // docs/product-vision-backlog.md, ADR 0040) — a case-insensitive
    // substring match against the card's own title and summary, which
    // already carry the real entity name every capability puts there
    // (customer name, contact name, task name, goal name — see each
    // capability's own finding-building code). No separate entity search
    // query: this reuses exactly the cards already rendered.
    const haystack = `${card.title} ${card.summary}`.toLowerCase();
    return haystack.includes(String(filter.value).toLowerCase());
  }

  // field === "owner"
  return filter.operator === "eq" ? card.owner?.name === filter.value : true;
}

function applyFilters(
  cards: readonly IntelligenceCard[],
  filters: readonly FilterDefinition[],
): readonly IntelligenceCard[] {
  if (filters.length === 0) {
    return cards;
  }

  return cards.filter((card) =>
    filters.every((filter) => matchesFilter(card, filter)),
  );
}

const filterFieldLabel: Record<FilterDefinition["field"], string> = {
  financialAmount: "Value",
  severity: "Severity",
  owner: "Owner",
  text: "Search",
};

// Distinguishes genuine creations from idempotent replays (a re-run of
// "create a task for these" hits the same idempotency keys) so the
// message never overstates how many new tasks actually exist now.
function describeCommandTaskResult(
  created: number,
  alreadyExisted: number,
): string {
  if (created === 0 && alreadyExisted === 0) {
    return "No tasks were created.";
  }

  const parts: string[] = [];

  if (created > 0) {
    parts.push(`Created ${created} task${created === 1 ? "" : "s"}`);
  }

  if (alreadyExisted > 0) {
    parts.push(
      `${alreadyExisted} ${alreadyExisted === 1 ? "was" : "were"} already created`,
    );
  }

  return `${parts.join("; ")}.`;
}

function describeFilter(filter: FilterDefinition): string {
  if (filter.field === "text") {
    return `${filterFieldLabel.text}: "${filter.value}"`;
  }

  const operator = filter.operator === "gte" ? "≥" : "=";
  const value =
    filter.field === "financialAmount"
      ? `$${filter.value}`
      : String(filter.value);

  return `${filterFieldLabel[filter.field]} ${operator} ${value}`;
}

export function CommandCenterBoard({
  initialCards,
  createTaskAction,
  parseCommandAction,
  runAgentInvestigationAction,
  aiInvestigationAvailable,
  approveAgentActionProposalAction,
  dismissAgentActionProposalAction,
  simulateInvoicePaymentAction,
  recordCardFeedbackAction,
}: {
  initialCards: readonly IntelligenceCard[];
  createTaskAction: CreateInternalTaskAction;
  parseCommandAction: ParseCommandAction;
  /**
   * Optional: absent when the Agent Fabric feature isn't wired in for this
   * deployment. When present, "investigate risk" in the command bar becomes
   * a real, business-wide investigation instead of an unrecognized command.
   */
  runAgentInvestigationAction?: RunAgentInvestigationAction;
  /** The real, live `isAgentFabricEnabled()` kill-switch state
   * (`_lib/agent-config.ts`), computed server-side — distinct from
   * `runAgentInvestigationAction` being wired at all: the action can be
   * present but the org-wide switch still off. Passed through to
   * `CommandBar` so that's surfaced proactively rather than only
   * discovered after typing "investigate" and getting a decline back. */
  aiInvestigationAvailable: boolean;
  approveAgentActionProposalAction?: ApproveAgentActionProposalAction;
  dismissAgentActionProposalAction?: DismissAgentActionProposalAction;
  simulateInvoicePaymentAction?: SimulateInvoicePaymentAction;
  recordCardFeedbackAction?: RecordCardFeedbackAction;
}) {
  const router = useRouter();
  const [activeFilters, setActiveFilters] = useState<
    readonly FilterDefinition[]
  >([]);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Cards the Agent Fabric added this session — concatenated with
  // whichever deterministic card list is current (the server-rendered
  // initialCards until the first poll lands, the polled snapshot after)
  // rather than replacing them, since an investigation only ever adds one
  // reconciled recommendation on top of what the deterministic side
  // already showed. A poll tick never carries a prior agent investigation
  // result — that's real client-session state, not something
  // `getTodaysAttention` recomputes — so it's never a candidate for
  // replacement here.
  const [agentCards, setAgentCards] = useState<readonly IntelligenceCard[]>([]);
  const { snapshot: polledSnapshot, error: pollError } = useBusinessSnapshot({
    pollIntervalMs: POLL_INTERVAL_MS,
  });

  // Prefer the freshest polled cards once a poll has actually completed;
  // fall back to the real server-rendered set before that (never an empty
  // flash while the first background poll is still in flight).
  const deterministicCards = useMemo(
    () => polledSnapshot?.cards.map(reviveCard) ?? initialCards,
    [polledSnapshot, initialCards],
  );

  const allCards = useMemo(
    () => [...deterministicCards, ...agentCards],
    [deterministicCards, agentCards],
  );

  const visibleCards = useMemo(() => {
    if (focusedCardId) {
      return allCards.filter((card) => card.id === focusedCardId);
    }

    return applyFilters(allCards, activeFilters);
  }, [allCards, activeFilters, focusedCardId]);

  function clearView() {
    setActiveFilters([]);
    setFocusedCardId(null);
    setStatusMessage(null);
  }

  function handleSubmitCommand(text: string) {
    startTransition(async () => {
      const result = await parseCommandAction(text, visibleCards);

      if (!result.recognized) {
        setStatusMessage(
          `I didn't understand "${result.rawText}." Try a filter, a why question, or "create a task for these."`,
        );
        return;
      }

      const { intent } = result;

      if (intent.type === "filter") {
        setFocusedCardId(null);
        setActiveFilters(intent.filters);
        const matchCount = applyFilters(allCards, intent.filters).length;
        setStatusMessage(
          matchCount === 0
            ? "No cards match that filter right now."
            : `Showing ${matchCount} card${matchCount === 1 ? "" : "s"} matching that filter.`,
        );
        return;
      }

      if (intent.type === "investigate") {
        setActiveFilters([]);
        setFocusedCardId(intent.entityId);
        setStatusMessage(
          "Focused on that item. Ask again or clear to see everything.",
        );
        return;
      }

      if (
        intent.type === "propose_action" &&
        intent.actionType === "create_internal_task"
      ) {
        const targets = allCards.filter((card) =>
          intent.targets.includes(card.id),
        );
        let created = 0;
        let alreadyExisted = 0;

        for (const card of targets) {
          const taskResult = await createTaskAction({
            title: buildTaskTitle("Follow up", card.title),
            sourceCardId: card.id,
            idempotencyKey: `command-task:${card.id}`,
          });

          if (taskResult.ok) {
            if (taskResult.task.created) {
              created += 1;
            } else {
              alreadyExisted += 1;
            }
          }
        }

        setStatusMessage(describeCommandTaskResult(created, alreadyExisted));

        if (created > 0) {
          // Same gap CardActions' own router.refresh() closes: "Your
          // tasks" is server-rendered from data fetched before this
          // command ran, so a freshly created task needs a refresh to
          // actually appear there.
          router.refresh();
        }

        return;
      }

      if (intent.type === "agent_investigate") {
        if (!runAgentInvestigationAction) {
          setStatusMessage("AI investigation is not available.");
          return;
        }

        const investigation = await runAgentInvestigationAction();

        if (!investigation.ok) {
          setStatusMessage(`Investigation failed. ${investigation.error}`);
          return;
        }

        const newCard = investigation.card;

        if (newCard) {
          setFocusedCardId(null);
          setActiveFilters([]);
          setAgentCards((current) => [
            ...current.filter((card) => card.id !== newCard.id),
            newCard,
          ]);
        }

        setStatusMessage(investigation.message);
        return;
      }

      setStatusMessage("That command isn't supported yet.");
    });
  }

  return (
    <>
      <CommandBar
        isPending={isPending}
        statusMessage={statusMessage}
        onSubmitCommand={handleSubmitCommand}
        aiInvestigationAvailable={aiInvestigationAvailable}
      />

      {pollError ? (
        <p className="liveStatusNotice liveStatusNotice-paused" role="status">
          Live updates paused
          {polledSnapshot
            ? ` — showing cards as of ${formatRelativeTime(new Date(polledSnapshot.generatedAt), new Date())}.`
            : " — showing the data from when this page loaded."}
        </p>
      ) : polledSnapshot ? (
        <p className="liveStatusNotice" role="status">
          Cards updated{" "}
          {formatRelativeTime(new Date(polledSnapshot.generatedAt), new Date())}
          .
        </p>
      ) : null}

      {focusedCardId || activeFilters.length > 0 ? (
        <div className="activeViewBar" role="status">
          <div className="activeViewChips">
            {focusedCardId ? (
              <span className="filterChip">Focused on 1 item</span>
            ) : (
              activeFilters.map((filter, index) => (
                <span className="filterChip" key={index}>
                  {describeFilter(filter)}
                </span>
              ))
            )}
          </div>
          <Button
            variant="ghost"
            className="clearViewButton"
            onClick={clearView}
          >
            Show all cards
          </Button>
        </div>
      ) : null}

      {visibleCards.length === 0 ? (
        <p className="noCardsMessage">
          {allCards.length === 0
            ? "No cards need your attention right now."
            : "Nothing matches the current view."}
        </p>
      ) : (
        <div className="dynamicCardStack">
          {visibleCards.map((card) =>
            renderCard(
              card,
              createTaskAction,
              approveAgentActionProposalAction,
              dismissAgentActionProposalAction,
              simulateInvoicePaymentAction,
              recordCardFeedbackAction,
            ),
          )}
        </div>
      )}

      <RecentActivityPanel
        recentActions={polledSnapshot?.recentActions ?? []}
        now={new Date()}
      />
    </>
  );
}
