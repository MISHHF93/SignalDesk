import { createHash, randomUUID } from "node:crypto";

import { endOfDateOnlyDayUtc } from "@signaldesk/domain";

import type { JiraIssue } from "./client";

/**
 * Maps a Jira Issue onto the shape `parseSourceTaskRecord`
 * (`@signaldesk/schemas`) expects. Mirrors
 * `mapAsanaTaskToSourceTaskRecord`'s own contract exactly: returns a
 * plain `unknown`-shaped object (runtime validation stays at the real
 * boundary in apps/web), and returns `null` (not a validation error) for
 * an issue with no due date — the same honest "not every issue has one"
 * case Asana's mapper already handles.
 *
 * Unlike Xero's dates, Jira's `updated` timestamp
 * (`yyyy-MM-ddTHH:mm:ss.SSS+ZZZZ`) parses correctly with plain
 * `new Date(...)` — no custom parser needed (verified this session, not
 * assumed).
 */

export function mapJiraIssueToSourceTaskRecord(
  issue: JiraIssue,
  now: Date,
): unknown | null {
  if (!issue.fields.duedate) {
    return null;
  }

  const recordDigestSha256 = createHash("sha256")
    .update(JSON.stringify(issue))
    .digest("hex");

  return {
    id: randomUUID(),
    name: issue.fields.summary,
    assigneeName: issue.fields.assignee?.displayName?.trim() || null,
    // duedate is date-only ("yyyy-MM-dd", no time) — end-of-day UTC, not
    // JS's own UTC-midnight default. See endOfDateOnlyDayUtc's own doc
    // comment (@signaldesk/domain) for why.
    dueAt: endOfDateOnlyDayUtc(issue.fields.duedate),
    // A `statusCategory != Done` query (this connector's own scope, see
    // client.ts's doc comment) never returns a completed issue — every
    // mapped record is honestly `false`, not inferred from `status.name`
    // string-matching against an unbounded set of custom workflow names.
    completed: false,
    source: {
      system: "jira",
      externalRecordId: issue.id,
      sourceVersion: issue.fields.updated,
      recordDigestSha256,
      lastSyncedAt: now.toISOString(),
    },
  };
}
