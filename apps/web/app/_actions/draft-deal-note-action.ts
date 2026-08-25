"use server";

import type { DealNoteDraftContext } from "@signaldesk/application";
import type { Lead } from "@signaldesk/domain";
import { getLeadById } from "@signaldesk/persistence";

import type { DraftDealNoteActionResult } from "../_lib/actions";
import { draftEntityContentAction } from "../_lib/draft-entity-content-action";

/**
 * The drafting half of ADR 0057's HubSpot deal-note flow — the generalized-
 * orchestrator counterpart to `draft-message-reply-action.ts`, configured
 * for HubSpot instead of Gmail. Every field the draft needs already comes
 * from this app's own normalized `leads` row — no new ingestion boundary
 * crossed, unlike Zendesk's live comment fetch.
 */
const draft = draftEntityContentAction<Lead, DealNoteDraftContext>({
  findingType: "lead.follow_up_risk",
  entityKind: "lead",
  newFindingType: "lead.note_drafted",
  actionType: "post_deal_note",
  capability: "draft_deal_note",
  objective: "Draft a note for this stalled deal.",
  keyPrefix: "deal-note-draft",
  declinedEventType: "deal_note_draft.declined",
  notFoundMessage: "This deal is no longer at risk.",
  staleEvidenceMessage:
    "The evidence behind this deal hasn't refreshed recently enough to draft a note confidently right now.",
  loadFailedMessage: "Could not load this deal.",
  draftedMessage: "Note drafted.",
  draftFailedMessage: "Couldn't draft a note right now.",
  fetchEntity: (db, organizationId, leadId) =>
    getLeadById(db, organizationId, leadId),
  buildDraftContext: (lead, finding) => ({
    capability: "draft_deal_note",
    finding,
    contactName: lead.contactName,
    companyName: lead.companyName,
    stage: lead.stage,
    valueCents: lead.valueCents,
    currency: lead.currency,
    lastInteractionAt: lead.lastInteractionAt,
  }),
  collaborationEntityRef: (leadId) => ({ leadId }),
});

export async function draftDealNoteAction(
  leadId: string,
): Promise<DraftDealNoteActionResult> {
  return draft(leadId);
}
