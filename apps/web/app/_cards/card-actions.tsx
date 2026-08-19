"use client";

import type {
  ActionProposal,
  IntelligenceCard,
} from "@business-dashboard/schemas";
import { useState, useTransition } from "react";

import { Button } from "../_components/button";
import type { CreateInternalTaskAction } from "../_lib/actions";
import { buildTaskTitle } from "../_lib/task-title";

type ActionStatus = "idle" | "pending" | "success" | "error";

/**
 * Renders each of a card's `recommendedActions` as a real button wired to
 * the safe action gateway's one implemented action. Follows the
 * optimistic-vs-verified rule: the button never claims "Done" until the
 * server action returns a verified result or a real failure.
 */
export function CardActions({
  card,
  createTaskAction,
}: {
  card: IntelligenceCard;
  createTaskAction: CreateInternalTaskAction;
}) {
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (card.recommendedActions.length === 0) {
    return null;
  }

  function handleCreateTask(action: ActionProposal) {
    setStatus("pending");
    setMessage(null);

    startTransition(async () => {
      const result = await createTaskAction({
        title: buildTaskTitle(action.label, card.title),
        sourceCardId: card.id,
        // Stable across a double-click or network retry — this specific
        // card's specific recommended action should only ever create one
        // task, never one per click.
        idempotencyKey: `card-action:${card.id}:${action.id}`,
      });

      if (result.ok) {
        setStatus("success");
        setMessage(
          result.task.created
            ? `Created "${result.task.title}" at ${new Date(
                result.task.createdAt,
              ).toLocaleTimeString()}.`
            : `Already created "${result.task.title}" — no duplicate was made.`,
        );
      } else {
        setStatus("error");
        setMessage(`Action failed. ${result.error}`);
      }
    });
  }

  return (
    <div className="cardActions">
      {card.recommendedActions.map((action) => (
        <Button
          key={action.id}
          variant="primary"
          className="cardActionButton"
          disabled={isPending}
          onClick={() => handleCreateTask(action)}
        >
          {isPending ? "Sending…" : action.label}
        </Button>
      ))}
      {message ? (
        <p
          className={`cardActionStatus cardActionStatus-${status}`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
