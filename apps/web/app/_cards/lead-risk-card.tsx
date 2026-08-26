import { CardShell } from "./card-shell";
import type { CardComponentProps } from "./card-types";
import { DraftActionButton } from "./draft-action-button";

/**
 * The "Draft note" button (ADR 0057) fires `draftDealNoteAction`
 * immediately — no approval gate here, since drafting has no external
 * effect, mirroring `MessageFollowUpCard`/`TaskRiskCard`/`TicketRiskCard`'s
 * own draft buttons exactly. Its result is a separate `agent_recommendation`
 * card, handed to `onAgentCardProduced` — the actual post is approved from
 * that card, via `AgentRecommendationCard`.
 */
export function LeadRiskCard({
  card,
  createTaskAction,
  recordCardFeedbackAction,
  draftDealNoteAction,
  onAgentCardProduced,
}: CardComponentProps) {
  return (
    <CardShell
      card={card}
      createTaskAction={createTaskAction}
      ownerLabel="Owner"
      {...(recordCardFeedbackAction ? { recordCardFeedbackAction } : {})}
      footerActions={
        draftDealNoteAction && card.entity && card.entity.kind === "lead" ? (
          <DraftActionButton
            entityId={card.entity.id}
            action={draftDealNoteAction}
            idleLabel="Draft note"
            errorPrefix="Couldn't draft a note."
            {...(onAgentCardProduced ? { onAgentCardProduced } : {})}
          />
        ) : null
      }
    />
  );
}
