import {
  createDatabasePool,
  getSupportTicketById,
  type DatabasePool,
} from "@signaldesk/persistence";
import { notFound } from "next/navigation";

import { formatRelativeTime } from "../../_cards/format";
import { getCurrentOrganization } from "../../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  open: "Open",
  pending: "Pending",
  hold: "On hold",
  solved: "Solved",
  closed: "Closed",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

/**
 * Shared by the full-page route (`[id]/page.tsx`, the real destination
 * for a direct visit or refresh) and the intercepted drawer route
 * (`@modal/(.)tickets/[id]/page.tsx`, what a click from the command
 * center opens instead) — mirrors `ConnectorDetailContent`'s exact
 * split, one data-fetching/rendering path, not two copies to drift.
 */
export async function TicketDetailContent({ ticketId }: { ticketId: string }) {
  const session = await getCurrentOrganization();

  if (!session) notFound();

  const ticket = await getSupportTicketById(
    getPool(),
    session.organizationId,
    ticketId,
  );

  if (!ticket) notFound();

  const now = new Date();

  return (
    <>
      <div className="ticketDetailHeader">
        <div>
          <div className="badgeRow connectorDetailBadges">
            <span className="availabilityBadge preview">
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>
            {ticket.priority ? (
              <span className="readOnlyBadge">
                {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
              </span>
            ) : null}
          </div>
          <p className="sectionKicker">Support ticket</p>
          <h1>{ticket.subject}</h1>
        </div>
      </div>

      <dl className="detailFacts ticketDetailFacts">
        <div>
          <dt>Requester</dt>
          <dd>{ticket.requesterName ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Assignee</dt>
          <dd>{ticket.owner?.name ?? ticket.assigneeName ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{formatRelativeTime(ticket.lastActivityAt, now)}</dd>
        </div>
        {ticket.dueAt ? (
          <div>
            <dt>Due</dt>
            <dd>{formatRelativeTime(ticket.dueAt, now)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Source</dt>
          <dd>{ticket.source.system}</dd>
        </div>
        <div>
          <dt>Synced</dt>
          <dd>{formatRelativeTime(ticket.source.lastSyncedAt, now)}</dd>
        </div>
      </dl>
    </>
  );
}
