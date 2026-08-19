import { createHash, randomUUID } from "node:crypto";

import type { AsanaTask } from "./client";

/**
 * Maps an Asana Task onto the shape `parseSourceTaskRecord`
 * (`@business-dashboard/schemas`) expects. Mirrors
 * `mapQuickBooksInvoiceToSourceInvoiceRecord`'s own contract exactly:
 * returns a plain `unknown`-shaped object (runtime validation stays at the
 * real boundary, the caller in apps/web), and returns `null` (not a
 * validation error) for a task with no due date — Asana tasks are
 * frequently undated, and "overdue" has no meaning without one.
 *
 * Prefers `due_at` (date-time) over `due_on` (date-only) when both are
 * absent/present is ambiguous per Asana's docs; a task typically has at
 * most one of the two set.
 */
export function mapAsanaTaskToSourceTaskRecord(
  task: AsanaTask,
  now: Date,
): unknown | null {
  const dueAt =
    task.due_at ?? (task.due_on ? `${task.due_on}T00:00:00Z` : null);

  if (!dueAt) {
    return null;
  }

  const recordDigestSha256 = createHash("sha256")
    .update(JSON.stringify(task))
    .digest("hex");

  return {
    id: randomUUID(),
    name: task.name.trim() || "Untitled Asana task",
    assigneeName: task.assignee?.name?.trim() || null,
    dueAt: new Date(dueAt).toISOString(),
    completed: task.completed,
    source: {
      system: "asana",
      externalRecordId: task.gid,
      sourceVersion: task.modified_at,
      recordDigestSha256,
      lastSyncedAt: now.toISOString(),
    },
  };
}
