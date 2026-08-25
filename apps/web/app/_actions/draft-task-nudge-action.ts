"use server";

import type { TaskNudgeDraftContext } from "@signaldesk/application";
import { daysOverdue, type Task } from "@signaldesk/domain";
import { getTaskById } from "@signaldesk/persistence";

import type { DraftTaskNudgeActionResult } from "../_lib/actions";
import { draftEntityContentAction } from "../_lib/draft-entity-content-action";

/**
 * The drafting half of ADR 0057's Asana task-nudge flow — the generalized-
 * orchestrator counterpart to `draft-message-reply-action.ts`, configured
 * for Asana instead of Gmail. See `draft-entity-content-action.ts` for the
 * shared kill-switch/rate-limit/evidence-sufficiency/advisory-lock
 * mechanics this reuses unchanged.
 */
const draft = draftEntityContentAction<Task, TaskNudgeDraftContext>({
  findingType: "task.overdue",
  entityKind: "task",
  newFindingType: "task.nudge_drafted",
  actionType: "post_task_nudge",
  capability: "draft_task_nudge",
  objective: "Draft a follow-up comment for this overdue task.",
  keyPrefix: "task-nudge-draft",
  declinedEventType: "task_nudge_draft.declined",
  notFoundMessage: "This task is no longer overdue.",
  staleEvidenceMessage:
    "The evidence behind this task hasn't refreshed recently enough to draft a nudge confidently right now.",
  loadFailedMessage: "Could not load this task.",
  draftedMessage: "Nudge drafted.",
  draftFailedMessage: "Couldn't draft a nudge right now.",
  fetchEntity: (db, organizationId, taskId) =>
    getTaskById(db, organizationId, taskId),
  buildDraftContext: (task, finding) => ({
    capability: "draft_task_nudge",
    finding,
    taskName: task.name,
    assigneeName: task.assigneeName,
    dueAt: task.dueAt,
    daysOverdue: daysOverdue(task.dueAt, new Date()),
  }),
  collaborationEntityRef: (taskId) => ({ taskId }),
});

export async function draftTaskNudgeAction(
  taskId: string,
): Promise<DraftTaskNudgeActionResult> {
  return draft(taskId);
}
