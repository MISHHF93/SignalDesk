"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "../_components/button";
import { CardShell } from "./card-shell";
import type { CardComponentProps } from "./card-types";
import { DraftedContentPreview } from "./drafted-content-preview";

type ActionStatus = "idle" | "pending" | "success" | "error";

/** The 5 connector send actions share this exact result shape (`{ ok:
 * true, alreadySent, ...a provider-specific id/timestamp field }` or
 * `ActionFailureResult`) — this is the minimal common structure
 * `handleApprove`'s shared branch below actually reads, deliberately not
 * importing each connector's own more specific result type (their extra
 * fields are never used here). */
interface ApproveSendResult {
  readonly ok: boolean;
  readonly alreadySent?: boolean;
  readonly error?: string;
  readonly reconnectSlug?: string;
}

type SendActionType =
  | "send_customer_email_reply"
  | "post_task_nudge"
  | "post_ticket_reply"
  | "post_deal_note"
  | "send_invoice_reminder";

/** The two messages that differ between the 5 connectors' otherwise
 * identical approve flow — everything else about handling the result is
 * shared. */
const SEND_ACTION_LABELS: Record<
  SendActionType,
  { readonly done: string; readonly alreadyDone: string }
> = {
  send_customer_email_reply: {
    done: "Reply sent.",
    alreadyDone: "Already sent — no duplicate was sent.",
  },
  post_task_nudge: {
    done: "Nudge posted.",
    alreadyDone: "Already posted — no duplicate was posted.",
  },
  post_ticket_reply: {
    done: "Reply sent.",
    alreadyDone: "Already sent — no duplicate was sent.",
  },
  post_deal_note: {
    done: "Note logged.",
    alreadyDone: "Already logged — no duplicate was logged.",
  },
  send_invoice_reminder: {
    done: "Reminder sent.",
    alreadyDone: "Already sent — no duplicate was sent.",
  },
};

function isSendActionType(actionType: string): actionType is SendActionType {
  return actionType in SEND_ACTION_LABELS;
}

/**
 * Renders one reconciled Agent Fabric recommendation — never a visible
 * swarm of per-specialist cards, per the mission's "one AI" rule. Its
 * proposed action always requires approval (see
 * dashboard-composition.ts's `isAgentAuthored` branch), so this renders
 * real Approve/Dismiss controls instead of `CardActions`' immediate-fire
 * button — passed into `CardShell` as `footerActions`, with no
 * `createTaskAction` given, so `CardShell` never renders `CardActions` for
 * this card type. `card.id` doubles as the real `agent_collaborations.id`
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
  const sendActionType =
    proposal?.actionType && isSendActionType(proposal.actionType)
      ? proposal.actionType
      : null;
  const sendActionsByType: Record<
    SendActionType,
    ((cardId: string) => Promise<ApproveSendResult>) | undefined
  > = {
    send_customer_email_reply: approveMessageReplyProposalAction,
    post_task_nudge: approveTaskNudgeProposalAction,
    post_ticket_reply: approveTicketReplyProposalAction,
    post_deal_note: approveDealNoteProposalAction,
    send_invoice_reminder: approveInvoiceReminderProposalAction,
  };
  const sendAction = sendActionType
    ? sendActionsByType[sendActionType]
    : undefined;

  function handleApprove() {
    if (sendActionType) {
      if (!sendAction) {
        // Real gap found by review: this used to return silently — a
        // completely invisible no-op if this card's proposal type ever
        // reached here without its matching approve action wired (e.g. a
        // connector not configured for this org). Reachable only via a
        // call site with partial wiring; page.tsx itself wires all five
        // unconditionally today. Defense in depth, not a currently
        // triggerable path.
        setStatus("error");
        setMessage("This action isn't available right now.");
        return;
      }

      const labels = SEND_ACTION_LABELS[sendActionType];

      setStatus("pending");
      setMessage(null);
      setReconnectSlug(null);

      startTransition(async () => {
        const result = await sendAction(card.id);

        if (result.ok) {
          setStatus("success");
          setMessage(result.alreadySent ? labels.alreadyDone : labels.done);
        } else {
          setStatus("error");
          setMessage(`Action failed. ${result.error}`);
          setReconnectSlug(result.reconnectSlug ?? null);
        }
      });

      return;
    }

    if (!approveAgentActionProposalAction) {
      setStatus("error");
      setMessage("This action isn't available right now.");
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
      setStatus("error");
      setMessage("This action isn't available right now.");
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
    <CardShell
      card={card}
      afterSummary={
        card.draftedContent ? (
          <DraftedContentPreview draftedContent={card.draftedContent} />
        ) : null
      }
      footerActions={
        <>
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
        </>
      }
    />
  );
}
