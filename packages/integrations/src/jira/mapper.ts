import { createHash, randomUUID } from "node:crypto";

import { endOfDateOnlyDayUtc } from "@signaldesk/domain";

import type { JiraIssue } from "./client";

// A real, non-null assignee whose `displayName` is redacted (Atlassian's
// documented per-user privacy setting can withhold `displayName`/
// `emailAddress` while still returning `accountId`) is a genuinely
// different case from the issue honestly having no assignee at all
// (`assignee === null`). Collapsing both into the same `null` output
// silently turns a real, owned issue into one that reads as unowned
// everywhere downstream (`overdue-task.ts`'s owner fallback, the "who
// owns it?" question this app exists to answer) — the same bug class
// already found and fixed for Asana's `resolveAsanaAssigneeName`/Zendesk's
// `resolveZendeskUserName`. Falls back to a placeholder carrying the real
// id instead.
function resolveJiraAssigneeName(
  assignee: JiraIssue["fields"]["assignee"],
): string | null {
  if (!assignee) {
    return null;
  }

  return assignee.displayName?.trim() || `Jira user ${assignee.accountId}`;
}

function isJiraAssigneeNameUnresolvable(issue: JiraIssue): boolean {
  return !!issue.fields.assignee && !issue.fields.assignee.displayName?.trim();
}

/**
 * Reports which critical fields this issue would need a fallback for,
 * without performing the mapping itself — same schema-drift-visibility
 * extension point as `detectAsanaTaskDefaultedFields`/
 * `detectHubSpotDealDefaultedFields`. Deliberately additive; never
 * changes mapping behavior itself.
 */
export function detectJiraIssueDefaultedFields(
  issue: JiraIssue,
): readonly string[] {
  return isJiraAssigneeNameUnresolvable(issue) ? ["assignee.displayName"] : [];
}

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
    assigneeName: resolveJiraAssigneeName(issue.fields.assignee),
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
