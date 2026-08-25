"use client";

import { useState, useTransition } from "react";

import { Button } from "../_components/button";
import { CardActions } from "./card-actions";
import { CardFeedbackButtons } from "./card-feedback-buttons";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";
import { formatCardCurrency } from "./format";

type DraftStatus = "idle" | "pending" | "error";

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
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDraftNote() {
    if (!draftDealNoteAction || !card.entity || card.entity.kind !== "lead") {
      return;
    }

    const leadId = card.entity.id;

    setStatus("pending");
    setMessage(null);

    startTransition(async () => {
      const result = await draftDealNoteAction(leadId);

      if (!result.ok) {
        setStatus("error");
        setMessage(`Couldn't draft a note. ${result.error}`);
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
          {card.financialContext ? (
            <div className="leadValue">
              <span>{card.financialContext.label}</span>
              <strong>
                {formatCardCurrency(
                  card.financialContext.amountCents,
                  card.financialContext.currency,
                )}
              </strong>
            </div>
          ) : null}
        </div>
        <p>{card.summary}</p>
        {card.owner ? (
          <p className="contactName">Owner: {card.owner.name}</p>
        ) : null}
        <div className="attentionFooter">
          <WhyDisclosure card={card} />
          <CardActions card={card} createTaskAction={createTaskAction} />
          {draftDealNoteAction ? (
            <div className="cardActions">
              <Button
                variant="ghost"
                className="cardActionButton"
                disabled={isPending}
                onClick={handleDraftNote}
              >
                {isPending ? "Drafting…" : "Draft note"}
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
