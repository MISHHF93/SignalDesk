import { createHash, randomUUID } from "node:crypto";

import { endOfDateOnlyDayUtc } from "@signaldesk/domain";

import type { AsanaTask } from "./client";

/**
 * Whether this task's `name` needs a fallback. Asana's API schema doesn't
 * document a non-empty constraint on `name` (only that it's a string), and
 * this app doesn't control what upstream data looks like (a task renamed
 * to blank via a partial update, an integration that created tasks without
 * one) — same "already-real, already-tested" category as HubSpot's
 * `dealname`/QuickBooks' `CustomerRef.name` fallback (see this file's own
 * "Untitled Asana task" test), just previously missing the same
 * audit-visibility companion function those connectors already have.
 */
function isTaskNameMissing(task: AsanaTask): boolean {
  return !task.name.trim();
}

// A real, non-null `gid` that has no resolvable `name` — a restricted-
// visibility user, a since-deactivated or merged Asana account, or any
// `opt_fields` omission — is a genuinely different case from the task
// honestly having no assignee at all (`assignee === null`). Collapsing
// both into the same `null` output (found by a deep audit) silently
// turns a real, owned task into one that reads as unowned everywhere
// downstream (`overdue-task.ts`'s owner fallback, the "who owns it?"
// question this app exists to answer). Falls back to a placeholder
// carrying the real id instead, the same pattern already used for
// Zendesk's `resolveZendeskUserName`/QuickBooks' `CustomerRef.name`.
function resolveAsanaAssigneeName(
  assignee: AsanaTask["assignee"],
): string | null {
  if (assignee === null) {
    return null;
  }

  return assignee.name?.trim() || `Asana user ${assignee.gid}`;
}

function isAsanaAssigneeNameUnresolvable(task: AsanaTask): boolean {
  return task.assignee !== null && !task.assignee.name?.trim();
}

/**
 * Reports which critical fields this task would need a fallback for,
 * without performing the mapping itself — same schema-drift-visibility
 * extension point as `detectHubSpotDealDefaultedFields`
 * (`hubspot/mapper.ts`, issue 5, `docs/25-issue-audit.md`). Deliberately
 * additive; never changes mapping behavior itself.
 */
export function detectAsanaTaskDefaultedFields(
  task: AsanaTask,
): readonly string[] {
  const defaulted: string[] = [];

  if (isTaskNameMissing(task)) {
    defaulted.push("name");
  }

  if (isAsanaAssigneeNameUnresolvable(task)) {
    defaulted.push("assignee.name");
  }

  return defaulted;
}

/**
 * Maps an Asana Task onto the shape `parseSourceTaskRecord`
 * (`@signaldesk/schemas`) expects. Mirrors
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
  // due_at is a real date-time — parses correctly as-is. due_on is
  // date-only ("yyyy-MM-dd", no time), so it needs end-of-day-UTC
  // treatment (endOfDateOnlyDayUtc's own doc comment,
  // @signaldesk/domain) rather than JS's own UTC-midnight default —
  // otherwise a due_on task registers overdue up to a day before its
  // real local due date for any US timezone.
  const dueAt = task.due_at
    ? new Date(task.due_at).toISOString()
    : task.due_on
      ? endOfDateOnlyDayUtc(task.due_on)
      : null;

  if (!dueAt) {
    return null;
  }

  const recordDigestSha256 = createHash("sha256")
    .update(JSON.stringify(task))
    .digest("hex");

  return {
    id: randomUUID(),
    name: isTaskNameMissing(task) ? "Untitled Asana task" : task.name.trim(),
    assigneeName: resolveAsanaAssigneeName(task.assignee),
    dueAt,
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
