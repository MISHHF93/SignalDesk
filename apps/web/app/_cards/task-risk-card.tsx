import { CardShell } from "./card-shell";
import type { CardComponentProps } from "./card-types";
import { DraftActionButton } from "./draft-action-button";

/**
 * The "Draft nudge" button (ADR 0057) fires `draftTaskNudgeAction`
 * immediately — no approval gate here, since drafting has no external
 * effect, mirroring `MessageFollowUpCard`'s own "Draft a reply" button
 * exactly. Its result is a separate `agent_recommendation` card (not a
 * change to this one), handed to `onAgentCardProduced` to join the board's
 * own card list — the actual post is approved from that card, via
 * `AgentRecommendationCard`.
 */
export function TaskRiskCard({
  card,
  createTaskAction,
  recordCardFeedbackAction,
  draftTaskNudgeAction,
  onAgentCardProduced,
}: CardComponentProps) {
  return (
    <CardShell
      card={card}
      createTaskAction={createTaskAction}
      ownerLabel="Assignee"
      {...(recordCardFeedbackAction ? { recordCardFeedbackAction } : {})}
      footerActions={
        draftTaskNudgeAction && card.entity && card.entity.kind === "task" ? (
          <DraftActionButton
            entityId={card.entity.id}
            action={draftTaskNudgeAction}
            idleLabel="Draft nudge"
            errorPrefix="Couldn't draft a nudge."
            {...(onAgentCardProduced ? { onAgentCardProduced } : {})}
          />
        ) : null
      }
    />
  );
}
