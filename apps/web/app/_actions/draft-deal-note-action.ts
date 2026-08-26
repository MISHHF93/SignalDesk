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
  draftingStepLabel: "Drafting deal note…",
  fetchEntity: (db, organizationId, leadId) =>
    getLeadById(db, organizationId, leadId),
  buildDraftContext: (lead, finding) => {
    // Real gap found by review: `leads` is a shared table — HubSpot and
    // Salesforce both ingest into it (ingestHubSpotDeal/
    // ingestSalesforceOpportunity, @signaldesk/persistence), distinguished
    // only by `lead.source.system`. Only the HubSpot note-create path
    // exists today (createHubSpotDealNote, approve-deal-note-action.ts) —
    // nothing here checked that before this fix, so a Salesforce-sourced
    // at-risk deal could be drafted and would only fail (or worse, attach
    // the wrong integration's access token) once approval tried to
    // actually log it through HubSpot. Checked at draft time too, not just
    // approval time, mirroring the QuickBooks invoice-reminder fix
    // (draft-invoice-reminder-action.ts).
    if (lead.source.system !== "hubspot") {
      throw new Error(
        `Deal notes can currently only be logged through HubSpot; this deal was synced from ${lead.source.system}.`,
      );
    }

    return {
      capability: "draft_deal_note",
      finding,
      contactName: lead.contactName,
      companyName: lead.companyName,
      stage: lead.stage,
      valueCents: lead.valueCents,
      currency: lead.currency,
      lastInteractionAt: lead.lastInteractionAt,
    };
  },
  collaborationEntityRef: (leadId) => ({ leadId }),
});

export async function draftDealNoteAction(
  leadId: string,
  draftId: string,
): Promise<DraftDealNoteActionResult> {
  return draft(leadId, draftId);
}
