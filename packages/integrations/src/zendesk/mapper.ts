import { createHash, randomUUID } from "node:crypto";

import type { ZendeskTicket, ZendeskUser } from "./client";

/**
 * Maps a Zendesk Ticket onto the shape `parseSourceSupportTicketRecord`
 * (`@signaldesk/schemas`) expects. Mirrors `mapJiraIssueToSourceTaskRecord`'s
 * own contract: returns a plain `unknown`-shaped object (runtime
 * validation stays at the real boundary in apps/web). Unlike Jira's
 * mapper, this never returns `null` — a ticket's due date is honestly
 * optional (see `SupportTicket`'s own doc comment, `@signaldesk/domain`),
 * not a reason to skip ingesting the ticket at all.
 *
 * `assignee_id`/`requester_id` resolve to real names via the side-loaded
 * `users` array (`?include=users`, `client.ts`'s own doc comment) rather
 * than a second API call — `users` is the exact array Zendesk returned
 * alongside this same page of tickets.
 */

// A real, non-null id that the side-load doesn't cover — e.g. an agent
// who has since left the org, or a merged/deleted end-user, both
// realistic over a ticket's lifetime — is a genuinely different case
// from the ticket honestly having no requester/assignee at all
// (`=== null`). Falling back to `null` for both collapsed that
// distinction silently (found by a deep audit, 2026-08-22); this
// resolver instead falls back to a placeholder carrying the real id, the
// same "keep the id visible rather than let it vanish" pattern this
// codebase already uses for QuickBooks' `CustomerRef.name`/Asana's task
// `name`.
function resolveZendeskUserName(
  userId: number | null,
  userNameById: ReadonlyMap<number, string>,
): string | null {
  if (userId === null) {
    return null;
  }

  return userNameById.get(userId) ?? `Zendesk user ${userId}`;
}

function isZendeskUserUnresolvable(
  userId: number | null,
  userNameById: ReadonlyMap<number, string>,
): boolean {
  return userId !== null && !userNameById.has(userId);
}

/**
 * Reports which critical fields this ticket would need a fallback for,
 * without performing the mapping itself — same schema-drift-visibility
 * extension point as `detectHubSpotDealDefaultedFields`
 * (`hubspot/mapper.ts`, issue 5, `docs/25-issue-audit.md`). Deliberately
 * additive; never changes mapping behavior itself.
 */
export function detectZendeskTicketDefaultedFields(
  ticket: ZendeskTicket,
  users: readonly ZendeskUser[],
): readonly string[] {
  const userNameById = new Map(users.map((user) => [user.id, user.name]));
  const defaulted: string[] = [];

  if (isZendeskUserUnresolvable(ticket.requester_id, userNameById)) {
    defaulted.push("requester_id");
  }

  if (isZendeskUserUnresolvable(ticket.assignee_id, userNameById)) {
    defaulted.push("assignee_id");
  }

  return defaulted;
}

export function mapZendeskTicketToSourceSupportTicketRecord(
  ticket: ZendeskTicket,
  users: readonly ZendeskUser[],
  now: Date,
): unknown {
  const userNameById = new Map(users.map((user) => [user.id, user.name]));

  const recordDigestSha256 = createHash("sha256")
    .update(JSON.stringify(ticket))
    .digest("hex");

  return {
    id: randomUUID(),
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    requesterName: resolveZendeskUserName(ticket.requester_id, userNameById),
    assigneeName: resolveZendeskUserName(ticket.assignee_id, userNameById),
    dueAt: ticket.due_at ? new Date(ticket.due_at).toISOString() : null,
    lastActivityAt: new Date(ticket.updated_at).toISOString(),
    source: {
      system: "zendesk",
      externalRecordId: String(ticket.id),
      sourceVersion: ticket.updated_at,
      recordDigestSha256,
      lastSyncedAt: now.toISOString(),
    },
  };
}
