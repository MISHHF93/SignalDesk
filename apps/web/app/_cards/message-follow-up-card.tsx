"use client";

import { useState, useTransition } from "react";

import { Button } from "../_components/button";
import { CardActions } from "./card-actions";
import { CardFeedbackButtons } from "./card-feedback-buttons";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";

type DraftStatus = "idle" | "pending" | "error";

/**
 * Mirrors `TaskRiskCard` exactly — no financial context, no owner
 * (messages have no owner/assignee concept in this phase). Re-checked
 * 2026-08-23: this comment previously said `CardFeedbackButtons` was out
 * of scope pending a `card_feedback.card_type` check-constraint
 * migration — migration 0055 (`card_feedback_type_sync.sql`) already
 * widened that constraint to cover `message_follow_up` (and every other
 * real card type), so the prerequisite this note described is done; the
 * button is wired in below like every other risk-finding card. The
 * counterparty is already named in `card.summary` (see
 * `evaluateMessageAwaitingReply`, `@signaldesk/domain`), so no separate
 * contact line is needed here.
 *
 * The "Draft a reply" button (ADR 0056) fires `draftMessageReplyAction`
 * immediately — no approval gate here, since drafting has no external
 * effect. Its result is a separate `agent_recommendation` card (not a
 * change to this one), handed to `onAgentCardProduced` to join the board's
 * own card list — the actual send is approved from that card, via
 * `AgentRecommendationCard`.
 */
export function MessageFollowUpCard({
  card,
  createTaskAction,
  recordCardFeedbackAction,
  draftMessageReplyAction,
  onAgentCardProduced,
}: CardComponentProps) {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDraftReply() {
    if (
      !draftMessageReplyAction ||
      !card.entity ||
      card.entity.kind !== "message"
    ) {
      return;
    }

    const messageId = card.entity.id;

    setStatus("pending");
    setMessage(null);

    startTransition(async () => {
      const result = await draftMessageReplyAction(messageId);

      if (!result.ok) {
        setStatus("error");
        setMessage(`Couldn't draft a reply. ${result.error}`);
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
        <div className="attentionFooter">
          <WhyDisclosure card={card} />
          <CardActions card={card} createTaskAction={createTaskAction} />
          {draftMessageReplyAction ? (
            <div className="cardActions">
              <Button
                variant="ghost"
                className="cardActionButton"
                disabled={isPending}
                onClick={handleDraftReply}
              >
                {isPending ? "Drafting…" : "Draft a reply"}
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
