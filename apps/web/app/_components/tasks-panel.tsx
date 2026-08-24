"use client";

import type { OpenInternalTask } from "@signaldesk/persistence";
import { useState, useTransition } from "react";

import { formatRelativeTime } from "../_cards/format";
import type { CompleteInternalTaskAction } from "../_lib/actions";
import { Button } from "./button";

type TaskRowStatus = "idle" | "pending" | "error";

/**
 * The other half of the loop a card's "create a task" quick action
 * (`CardActions`) only ever started: every open internal task, with a real
 * one-click "Mark done" wired to the safe action gateway's other real write
 * (`completeInternalTaskAction`). A task leaves this list only once the
 * server has verified it completed — never optimistically before that,
 * matching `CardActions`' own "never claim done before the server does"
 * rule. Renders nothing once every open task has been completed, the same
 * "no empty husk" choice `RecentActivityPanel` makes.
 */
export function TasksPanel({
  openTasks,
  completeInternalTaskAction,
  now,
}: {
  readonly openTasks: readonly OpenInternalTask[];
  readonly completeInternalTaskAction: CompleteInternalTaskAction;
  readonly now: Date;
}) {
  const [completedIds, setCompletedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [statusByTaskId, setStatusByTaskId] = useState<
    Readonly<Record<string, TaskRowStatus>>
  >({});
  const [errorByTaskId, setErrorByTaskId] = useState<
    Readonly<Record<string, string>>
  >({});
  const [, startTransition] = useTransition();

  const visibleTasks = openTasks.filter((task) => !completedIds.has(task.id));

  if (visibleTasks.length === 0) {
    return null;
  }

  function handleComplete(taskId: string) {
    setStatusByTaskId((prev) => ({ ...prev, [taskId]: "pending" }));
    setErrorByTaskId((prev) => {
      if (!(taskId in prev)) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });

    startTransition(async () => {
      const result = await completeInternalTaskAction({ taskId });

      if (result.ok) {
        setCompletedIds((prev) => new Set(prev).add(taskId));
        setStatusByTaskId((prev) => ({ ...prev, [taskId]: "idle" }));
      } else {
        setStatusByTaskId((prev) => ({ ...prev, [taskId]: "error" }));
        setErrorByTaskId((prev) => ({ ...prev, [taskId]: result.error }));
      }
    });
  }

  return (
    <section className="tasksSection" aria-labelledby="tasks-heading">
      <p className="sectionKicker" id="tasks-heading">
        Your tasks
      </p>
      <ul className="tasksList">
        {visibleTasks.map((task) => {
          const status = statusByTaskId[task.id] ?? "idle";
          const isPending = status === "pending";

          return (
            <li className="taskRow" key={task.id}>
              <div className="taskRowMain">
                <span className="taskTitle">{task.title}</span>
                <span className="taskMeta">
                  Added {formatRelativeTime(task.createdAt, now)}
                </span>
                {status === "error" ? (
                  <span className="taskRowError" role="alert">
                    {errorByTaskId[task.id]}
                  </span>
                ) : null}
              </div>
              <Button
                variant="secondary"
                className="taskCompleteButton"
                disabled={isPending}
                onClick={() => handleComplete(task.id)}
              >
                {isPending ? "Marking done…" : "Mark done"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
