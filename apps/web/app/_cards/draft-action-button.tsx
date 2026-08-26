"use client";

import type { IntelligenceCard } from "@signaldesk/schemas";
import { useState, useTransition } from "react";

import { Button } from "../_components/button";
import type { DraftEntityContentActionResult } from "../_lib/actions";

type DraftStatus = "idle" | "pending" | "error";

/**
 * The draft-then-approve state machine shared by every ADR 0056/0057
 * connector's "Draft X" button — previously hand-duplicated identically
 * (byte for byte, aside from the action/labels below) in four card files,
 * plus a near-identical fifth (`DraftInvoiceReminderButton`, now replaced by
 * this component). Every draft action shares the exact same result shape
 * (`DraftEntityContentActionResult`), so one generic component covers all
 * five — the entity kind check that gates whether to render this at all
 * stays in each card file, since only the card knows which `card.entity.kind`
 * it expects.
 */
export function DraftActionButton({
  entityId,
  action,
  idleLabel,
  errorPrefix,
  onAgentCardProduced,
}: {
  readonly entityId: string;
  readonly action: (
    entityId: string,
  ) => Promise<DraftEntityContentActionResult>;
  /** e.g. "Draft note", "Draft nudge", "Draft reply", "Draft a reply". */
  readonly idleLabel: string;
  /** e.g. "Couldn't draft a note.", "Couldn't draft a reminder." */
  readonly errorPrefix: string;
  readonly onAgentCardProduced?: (card: IntelligenceCard) => void;
}) {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setStatus("pending");
    setMessage(null);

    startTransition(async () => {
      const result = await action(entityId);

      if (!result.ok) {
        setStatus("error");
        setMessage(`${errorPrefix} ${result.error}`);
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
    <div className="cardActions">
      <Button
        variant="ghost"
        className="cardActionButton"
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? "Drafting…" : idleLabel}
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
  );
}
