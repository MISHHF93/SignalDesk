"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "../_components/button";
import { CardBadges, WhyDisclosure } from "./card-shell";
import type { CardComponentProps } from "./card-types";

type ActionStatus = "idle" | "pending" | "success" | "error";

/**
 * Renders one reconciled Agent Fabric recommendation — never a visible
 * swarm of per-specialist cards, per the mission's "one AI" rule. Its
 * proposed action always requires approval (see
 * dashboard-composition.ts's `isAgentAuthored` branch), so this renders
 * real Approve/Dismiss controls instead of `CardActions`' immediate-fire
 * button. `card.id` doubles as the real `agent_collaborations.id`
 * (run-agent-investigation.ts overrides the reconciler's synthetic id with
 * the real collaboration id before composing cards), so no extra field is
 * needed to correlate the click back to its collaboration row.
 */
export function AgentRecommendationCard({
  card,
  approveAgentActionProposalAction,
  dismissAgentActionProposalAction,
}: CardComponentProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const proposal = card.recommendedActions[0];

  function handleApprove() {
    if (!approveAgentActionProposalAction) {
      return;
    }

    setStatus("pending");
    setMessage(null);

    startTransition(async () => {
      const result = await approveAgentActionProposalAction(card.id);

      if (result.ok) {
        setStatus("success");
        setMessage(
          result.created
            ? "Task created."
            : "Already created — no duplicate was made.",
        );
        // Same gap CardActions' own router.refresh() closes: "Your
        // tasks" is server-rendered from data fetched before this
        // approval, so the newly created task needs a refresh to
        // actually appear there.
        if (result.created) {
          router.refresh();
        }
      } else {
        setStatus("error");
        setMessage(`Action failed. ${result.error}`);
      }
    });
  }

  function handleDismiss() {
    if (!dismissAgentActionProposalAction) {
      return;
    }

    setStatus("pending");
    setMessage(null);

    startTransition(async () => {
      const result = await dismissAgentActionProposalAction(card.id);

      if (result.ok) {
        setStatus("success");
        setMessage("Dismissed.");
      } else {
        setStatus("error");
        setMessage(`Action failed. ${result.error}`);
      }
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
          {proposal?.requiresApproval && status !== "success" ? (
            <div className="cardActions">
              <Button
                variant="primary"
                className="cardActionButton"
                disabled={isPending}
                onClick={handleApprove}
              >
                {isPending ? "Sending…" : "Approve"}
              </Button>
              <Button
                variant="ghost"
                className="cardActionButton"
                disabled={isPending}
                onClick={handleDismiss}
              >
                Dismiss
              </Button>
            </div>
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
      </div>
    </article>
  );
}
