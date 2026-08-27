"use client";

import type { IntelligenceCard } from "@signaldesk/schemas";
import { useState, useTransition } from "react";

import { Button } from "../_components/button";
import type { DraftEntityContentActionResult } from "../_lib/actions";
import { useInvestigationSteps } from "../_lib/use-investigation-steps";

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
 *
 * Extended (docs/adr/0063-agent-investigation-progress.md) with the same
 * real step-progress view the Work Mat gives investigations: a client-
 * generated draft id becomes the drafting collaboration's own primary key
 * (`agent_collaborations.id`), so `useInvestigationSteps` can poll for real
 * progress ("Loading context…", "Drafting X…") from the instant the button
 * is clicked, reusing the exact same table/route/hook/CSS — no new
 * infrastructure for this second, single-step-fan-out case.
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
    draftId: string,
  ) => Promise<DraftEntityContentActionResult>;
  /** e.g. "Draft note", "Draft nudge", "Draft reply", "Draft a reply". */
  readonly idleLabel: string;
  /** e.g. "Couldn't draft a note.", "Couldn't draft a reminder." */
  readonly errorPrefix: string;
  readonly onAgentCardProduced?: (card: IntelligenceCard) => void;
}) {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const draftSteps = useInvestigationSteps(activeDraftId);

  function handleClick() {
    setStatus("pending");
    setMessage(null);

    const draftId = crypto.randomUUID();
    setActiveDraftId(draftId);

    startTransition(async () => {
      try {
        const result = await action(entityId, draftId);

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
      } catch {
        // A transport-level failure (dropped connection, aborted
        // request) rejects rather than resolving `action(...)` — unlike
        // an in-action failure, which is already caught server-side and
        // returned as `{ ok: false }`. Without this, `status` stays
        // stuck at "pending" with no message, and the button silently
        // reverts to its idle label once React clears isPending —
        // indistinguishable from the click never registering.
        setStatus("error");
        setMessage(
          `${errorPrefix} A network error occurred — please try again.`,
        );
      } finally {
        setActiveDraftId(null);
      }
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
      {activeDraftId && draftSteps.length > 0 ? (
        <ul className="workMatSteps" aria-label="Draft progress">
          {draftSteps.map((step) => (
            <li
              key={step.stepIndex}
              className={`workMatStep workMatStep-${step.status}`}
            >
              <span className="workMatStepIndicator" aria-hidden="true" />
              {step.label}
            </li>
          ))}
        </ul>
      ) : null}
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
