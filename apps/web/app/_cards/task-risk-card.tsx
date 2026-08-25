"use client";

import { useState, useTransition } from "react";

import { Button } from "../_components/button";
import { CardActions } from "./card-actions";
import { CardFeedbackButtons } from "./card-feedback-buttons";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";

type DraftStatus = "idle" | "pending" | "error";

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
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDraftNudge() {
    if (!draftTaskNudgeAction || !card.entity || card.entity.kind !== "task") {
      return;
    }

    const taskId = card.entity.id;

    setStatus("pending");
    setMessage(null);

    startTransition(async () => {
      const result = await draftTaskNudgeAction(taskId);

      if (!result.ok) {
        setStatus("error");
        setMessage(`Couldn't draft a nudge. ${result.error}`);
        return;
      }

      if (result.card) {
        onAgentCardProduced?.(result.card);
      }

      setStatus("idle");
      setMessage(result.message);
    });
  }

  return (
    <article
      className="attentionCard dynamicCard"
      data-severity={card.severity}
      aria-label={card.title}
    >
      <div className="priorityRail" aria-hidden="true" />
      <div className="attentionMain">
        <div className="attentionHeader">
          <div>
            <CardBadges card={card} />
            <h3>{card.title}</h3>
          </div>
        </div>
        <p>{card.summary}</p>
        {card.owner ? (
          <p className="contactName">Assignee: {card.owner.name}</p>
        ) : null}
        <div className="attentionFooter">
          <WhyDisclosure card={card} />
          <CardActions card={card} createTaskAction={createTaskAction} />
          {draftTaskNudgeAction ? (
            <div className="cardActions">
              <Button
                variant="ghost"
                className="cardActionButton"
                disabled={isPending}
                onClick={handleDraftNudge}
              >
                {isPending ? "Drafting…" : "Draft nudge"}
              </Button>
              {message ? (
                <p
                  className={`cardActionStatus cardActionStatus-${status}`}
                  role="status"
                >
                  {message}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {recordCardFeedbackAction ? (
          <CardFeedbackButtons
            card={card}
            recordCardFeedbackAction={recordCardFeedbackAction}
          />
        ) : null}
      </div>
    </article>
  );
}
