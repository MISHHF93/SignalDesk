"use client";

import type { IntelligenceCard } from "@signaldesk/schemas";
import { useState, useTransition } from "react";

import type { RecordCardFeedbackAction } from "../_lib/actions";
import { Button } from "../_components/button";

type FeedbackChoice = "useful" | "not_relevant" | null;

/**
 * "Useful" / "Not relevant" — the real, narrow first slice of Adaptive
 * Attention (Prompt 17, `docs/product-vision-backlog.md`, ADR 0032).
 * Capture only: this does not change ranking or calibration yet, so the
 * confirmation is honest about that ("Feedback recorded" rather than
 * anything implying the card will behave differently).
 */
export function CardFeedbackButtons({
  card,
  recordCardFeedbackAction,
}: {
  card: IntelligenceCard;
  recordCardFeedbackAction: RecordCardFeedbackAction;
}) {
  const [chosen, setChosen] = useState<FeedbackChoice>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick(feedback: "useful" | "not_relevant") {
    setError(null);

    startTransition(async () => {
      const result = await recordCardFeedbackAction(
        card.id,
        card.type,
        feedback,
      );

      if (result.ok) {
        setChosen(feedback);
      } else {
        setError(result.error);
      }
    });
  }

  if (chosen) {
    return (
      <p className="cardFeedbackConfirmed" role="status">
        Feedback recorded — thanks.
      </p>
    );
  }

  return (
    <div className="cardFeedback">
      <Button
        variant="ghost"
        type="button"
        className="cardFeedbackButton"
        disabled={isPending}
        onClick={() => handleClick("useful")}
        aria-label="Mark this card useful"
      >
        Useful
      </Button>
      <Button
        variant="ghost"
        type="button"
        className="cardFeedbackButton"
        disabled={isPending}
        onClick={() => handleClick("not_relevant")}
        aria-label="Mark this card not relevant"
      >
        Not relevant
      </Button>
      {error ? (
        <p className="cardFeedbackError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
