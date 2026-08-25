"use client";

import Link from "next/link";
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
 * (run-agent-investigation.ts and draft-message-reply-action.ts both
 * override their finding's synthetic id with the real collaboration id
 * before composing cards), so no extra field is needed to correlate the
 * click back to its collaboration row.
 *
 * Several distinct proposal shapes reach this same component: a
 * `create_internal_task` proposal (approved via
 * `approveAgentActionProposalAction`), a `send_customer_email_reply`
 * proposal (ADR 0056 — approved via `approveMessageReplyProposalAction`
 * instead), and, as of ADR 0057, one more per connector (`post_task_nudge`
 * via `approveTaskNudgeProposalAction`, with QuickBooks/HubSpot/Zendesk's
 * own action types and approve actions following the same shape) — all
 * rendered with their drafted subject/body shown for review before send.
 */
export function AgentRecommendationCard({
  card,
  approveAgentActionProposalAction,
  approveMessageReplyProposalAction,
  approveTaskNudgeProposalAction,
  approveTicketReplyProposalAction,
  approveDealNoteProposalAction,
  approveInvoiceReminderProposalAction,
  dismissAgentActionProposalAction,
}: CardComponentProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  // Set only when an approve action's failure was classified
  // `reauth_required` (`classifyRecoveryStrategy`, ADR 0059) — turns
  // "reconnect X" from a dead-end sentence into a real one-click link to
  // `/integrations/[slug]` instead of making the operator go find it.
  const [reconnectSlug, setReconnectSlug] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const proposal = card.recommendedActions[0];
  const isEmailReply = proposal?.actionType === "send_customer_email_reply";
  const isTaskNudge = proposal?.actionType === "post_task_nudge";
  const isTicketReply = proposal?.actionType === "post_ticket_reply";
  const isDealNote = proposal?.actionType === "post_deal_note";
  const isInvoiceReminder = proposal?.actionType === "send_invoice_reminder";

  function handleApprove() {
    if (isEmailReply) {
      if (!approveMessageReplyProposalAction) {
        return;
      }

      setStatus("pending");
      setMessage(null);
      setReconnectSlug(null);

      startTransition(async () => {
        const result = await approveMessageReplyProposalAction(card.id);

        if (result.ok) {
          setStatus("success");
          setMessage(
            result.alreadySent
              ? "Already sent — no duplicate was sent."
              : "Reply sent.",
          );
        } else {
          setStatus("error");
          setMessage(`Action failed. ${result.error}`);
          setReconnectSlug(result.reconnectSlug ?? null);
        }
      });

      return;
    }

    if (isTaskNudge) {
      if (!approveTaskNudgeProposalAction) {
        return;
      }

      setStatus("pending");
      setMessage(null);
      setReconnectSlug(null);

      startTransition(async () => {
        const result = await approveTaskNudgeProposalAction(card.id);

        if (result.ok) {
          setStatus("success");
          setMessage(
            result.alreadySent
              ? "Already posted — no duplicate was posted."
              : "Nudge posted.",
          );
        } else {
          setStatus("error");
          setMessage(`Action failed. ${result.error}`);
          setReconnectSlug(result.reconnectSlug ?? null);
        }
      });

      return;
    }

    if (isTicketReply) {
      if (!approveTicketReplyProposalAction) {
        return;
      }

      setStatus("pending");
      setMessage(null);
      setReconnectSlug(null);

      startTransition(async () => {
        const result = await approveTicketReplyProposalAction(card.id);

        if (result.ok) {
          setStatus("success");
          setMessage(
            result.alreadySent
              ? "Already sent — no duplicate was sent."
              : "Reply sent.",
          );
        } else {
          setStatus("error");
          setMessage(`Action failed. ${result.error}`);
          setReconnectSlug(result.reconnectSlug ?? null);
        }
      });

      return;
    }

    if (isDealNote) {
      if (!approveDealNoteProposalAction) {
        return;
      }

      setStatus("pending");
      setMessage(null);
      setReconnectSlug(null);

      startTransition(async () => {
        const result = await approveDealNoteProposalAction(card.id);

        if (result.ok) {
          setStatus("success");
          setMessage(
            result.alreadySent
              ? "Already logged — no duplicate was logged."
              : "Note logged.",
          );
        } else {
          setStatus("error");
          setMessage(`Action failed. ${result.error}`);
          setReconnectSlug(result.reconnectSlug ?? null);
        }
      });

      return;
    }

    if (isInvoiceReminder) {
      if (!approveInvoiceReminderProposalAction) {
        return;
      }

      setStatus("pending");
      setMessage(null);
      setReconnectSlug(null);

      startTransition(async () => {
        const result = await approveInvoiceReminderProposalAction(card.id);

        if (result.ok) {
          setStatus("success");
          setMessage(
            result.alreadySent
              ? "Already sent — no duplicate was sent."
              : "Reminder sent.",
          );
        } else {
          setStatus("error");
          setMessage(`Action failed. ${result.error}`);
          setReconnectSlug(result.reconnectSlug ?? null);
        }
      });

      return;
    }

    if (!approveAgentActionProposalAction) {
      return;
    }

    setStatus("pending");
    setMessage(null);
    setReconnectSlug(null);

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
    setReconnectSlug(null);

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
        {card.draftedContent ? (
          <div className="draftedReply">
            {card.draftedContent.subject ? (
              <p className="draftedReplySubject">
                <strong>Subject:</strong> {card.draftedContent.subject}
              </p>
            ) : null}
            <blockquote className="draftedReplyBody">
              {card.draftedContent.body}
            </blockquote>
          </div>
        ) : null}
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
              {reconnectSlug ? (
                <>
                  {" "}
                  <Link
                    href={`/integrations/${reconnectSlug}`}
                    className="cardActionStatusLink"
                  >
                    Reconnect now
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
