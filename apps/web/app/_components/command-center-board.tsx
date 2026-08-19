"use client";

import type {
  FilterDefinition,
  IntelligenceCard,
} from "@business-dashboard/schemas";
import { useMemo, useState, useTransition } from "react";

import type {
  CreateInternalTaskAction,
  ParseCommandAction,
} from "../_lib/actions";
import { buildTaskTitle } from "../_lib/task-title";
import { renderCard } from "../_cards/registry";
import { Button } from "./button";
import { CommandBar } from "./command-bar";

function matchesFilter(
  card: IntelligenceCard,
  filter: FilterDefinition,
): boolean {
  if (filter.field === "financialAmount") {
    const amountCents = card.financialContext?.amountCents ?? 0;
    const thresholdDollars =
      typeof filter.value === "number" ? filter.value : Number(filter.value);
    const thresholdCents = thresholdDollars * 100;

    return filter.operator === "gte"
      ? amountCents >= thresholdCents
      : amountCents === thresholdCents;
  }

  if (filter.field === "severity") {
    return filter.operator === "eq" ? card.severity === filter.value : true;
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
}: {
  initialCards: readonly IntelligenceCard[];
  createTaskAction: CreateInternalTaskAction;
  parseCommandAction: ParseCommandAction;
}) {
  const [activeFilters, setActiveFilters] = useState<
    readonly FilterDefinition[]
  >([]);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleCards = useMemo(() => {
    if (focusedCardId) {
      return initialCards.filter((card) => card.id === focusedCardId);
    }

    return applyFilters(initialCards, activeFilters);
  }, [initialCards, activeFilters, focusedCardId]);

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
        const matchCount = applyFilters(initialCards, intent.filters).length;
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
        const targets = initialCards.filter((card) =>
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
      />

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
          {initialCards.length === 0
            ? "No cards need your attention right now."
            : "Nothing matches the current view."}
        </p>
      ) : (
        <div className="dynamicCardStack">
          {visibleCards.map((card) => renderCard(card, createTaskAction))}
        </div>
      )}
    </>
  );
}
