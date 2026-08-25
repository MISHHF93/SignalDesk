"use client";

import { useState, useTransition } from "react";

import type { IntelligenceCard } from "@signaldesk/schemas";

import type { DraftInvoiceReminderAction } from "../_lib/actions";
import { Button } from "../_components/button";

type DraftStatus = "idle" | "pending" | "error";

/**
 * The "Draft reminder" button (ADR 0057) — `InvoiceRiskCard`'s counterpart
 * to `TaskRiskCard`/`TicketRiskCard`/`LeadRiskCard`'s own draft buttons,
 * pulled into its own client component to match this card's existing
 * pattern (`InvoicePaymentScenarioButton`) for a server component that
 * needs one small interactive island rather than converting the whole
 * card to a client component. Fires immediately — no approval gate,
 * since drafting has no external effect. Its result is a separate
 * `agent_recommendation` card, handed to `onAgentCardProduced` — the
 * actual send is approved from that card, via `AgentRecommendationCard`.
 */
export function DraftInvoiceReminderButton({
  invoiceId,
  draftInvoiceReminderAction,
  onAgentCardProduced,
}: {
  readonly invoiceId: string;
  readonly draftInvoiceReminderAction: DraftInvoiceReminderAction;
  readonly onAgentCardProduced?: (card: IntelligenceCard) => void;
}) {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDraftReminder() {
    setStatus("pending");
    setMessage(null);

    startTransition(async () => {
      const result = await draftInvoiceReminderAction(invoiceId);

      if (!result.ok) {
        setStatus("error");
        setMessage(`Couldn't draft a reminder. ${result.error}`);
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
        onClick={handleDraftReminder}
      >
        {isPending ? "Drafting…" : "Draft reminder"}
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
