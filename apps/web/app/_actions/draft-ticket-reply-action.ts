"use server";

import type { TicketReplyDraftContext } from "@signaldesk/application";
import type { SupportTicket } from "@signaldesk/domain";
import { fetchZendeskTicketComments } from "@signaldesk/integrations/zendesk";
import {
  getSupportTicketById,
  getZendeskIntegrationStatus,
} from "@signaldesk/persistence";

import type { DraftTicketReplyActionResult } from "../_lib/actions";
import { draftEntityContentAction } from "../_lib/draft-entity-content-action";
import { ensureFreshZendeskAccessToken } from "../_lib/sync-zendesk";

const MAX_COMMENTS_FOR_DRAFTING = 5;

/**
 * The drafting half of ADR 0057's Zendesk ticket-reply flow. Unlike
 * QuickBooks/Asana/HubSpot's draft contexts (pure transforms of an
 * already-fetched entity), this one crosses a real, disclosed exception:
 * ticket comment/description content isn't ingested or stored anywhere in
 * this app today, so `buildDraftContext` fetches it LIVE from Zendesk at
 * draft time — a single on-demand read, never persisted, never reaching
 * `getTodaysAttention`/any `IntelligenceCapability` — mirroring
 * `getMessageDraftContext`'s privacy discipline for Gmail, but without a
 * new background ingestion pipeline (mirrors ADR 0056's `messages.ts`
 * exception in spirit, not in mechanism).
 */
const draft = draftEntityContentAction<SupportTicket, TicketReplyDraftContext>({
  findingType: "ticket.stuck",
  entityKind: "support_ticket",
  newFindingType: "ticket.reply_drafted",
  actionType: "post_ticket_reply",
  capability: "draft_ticket_reply",
  objective: "Draft a reply to this stuck support ticket.",
  keyPrefix: "ticket-reply-draft",
  declinedEventType: "ticket_reply_draft.declined",
  notFoundMessage: "This ticket is no longer stuck.",
  staleEvidenceMessage:
    "The evidence behind this ticket hasn't refreshed recently enough to draft a reply confidently right now.",
  loadFailedMessage: "Could not load this ticket.",
  draftedMessage: "Reply drafted.",
  draftFailedMessage: "Couldn't draft a reply right now.",
  fetchEntity: (db, organizationId, ticketId) =>
    getSupportTicketById(db, organizationId, ticketId),
  buildDraftContext: async (ticket, finding, db, organizationId) => {
    const integration = await getZendeskIntegrationStatus(db, organizationId);

    if (
      !integration ||
      (integration.status !== "active" && integration.status !== "degraded")
    ) {
      throw new Error("Reconnect Zendesk to draft a reply.");
    }

    const accessToken = await ensureFreshZendeskAccessToken(
      db,
      organizationId,
      integration.id,
      integration.externalAccountId,
    );

    const allComments = await fetchZendeskTicketComments(
      accessToken,
      integration.externalAccountId,
      Number(ticket.source.externalRecordId),
    );

    // Bounded the same way Gmail's message body is (ADR 0050): only the
    // most recent comments, never the full unbounded history — kept
    // in-memory for this one drafting call only, never stored.
    const recentComments = allComments.slice(-MAX_COMMENTS_FOR_DRAFTING);

    return {
      capability: "draft_ticket_reply",
      finding,
      subject: ticket.subject,
      requesterName: ticket.requesterName,
      recentComments,
      commentsTruncated: allComments.length > recentComments.length,
    };
  },
  collaborationEntityRef: (ticketId) => ({ supportTicketId: ticketId }),
});

export async function draftTicketReplyAction(
  ticketId: string,
): Promise<DraftTicketReplyActionResult> {
  return draft(ticketId);
}
