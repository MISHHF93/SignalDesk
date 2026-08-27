"use client";

import type { FilterDefinition, IntelligenceCard } from "@signaldesk/schemas";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import type {
  ApproveAgentActionProposalAction,
  ApproveDealNoteProposalAction,
  ApproveInvoiceReminderProposalAction,
  ApproveMessageReplyProposalAction,
  ApproveTaskNudgeProposalAction,
  ApproveTicketReplyProposalAction,
  CreateInternalTaskAction,
  DismissAgentActionProposalAction,
  DraftDealNoteAction,
  DraftInvoiceReminderAction,
  DraftMessageReplyAction,
  DraftTaskNudgeAction,
  DraftTicketReplyAction,
  ParseCommandAction,
  RecordCardFeedbackAction,
  RunAgentInvestigationAction,
  SimulateInvoicePaymentAction,
} from "../_lib/actions";
import {
  dispatchDraftForCard,
  getBatchDraftableCards,
  groupCardsIntoClusters,
  type CardCluster,
  type DraftActionsByEntityKind,
} from "../_lib/card-clustering";
import { buildTaskTitle } from "../_lib/task-title";
import {
  useBusinessSnapshot,
  type SnapshotCard,
} from "../_lib/use-business-snapshot";
import { useInvestigationSteps } from "../_lib/use-investigation-steps";
import { formatRelativeTime } from "../_cards/format";
import { renderCard, type CardActionHandlers } from "../_cards/registry";
import { Button } from "./button";
import { CommandBar } from "./command-bar";
import { RecentActivityPanel } from "./recent-activity-panel";

// Live UI (Phase 2 of the implementation roadmap): a plain interval, not
// WebSocket/SSE — the cheapest real prerequisite, reusing the existing
// rate-limited `/api/business/snapshot` route (30 req/min) rather than a
// new transport. None of the 8 registered deterministic capabilities call
// any AI provider, so a poll tick costs a database read, not an LLM call.
const POLL_INTERVAL_MS = 45_000;

/**
 * `useBusinessSnapshot` returns cards with every `Date` field serialized
 * to a JSON string (`BusinessSnapshotJSON`, the real shape a `fetch` of
 * `/api/business/snapshot` actually receives) — this restores the two
 * real `Date` fields `IntelligenceCard` has
 * (`freshness.asOf`, `sources[].lastSyncedAt`) so a polled card is a
 * genuine `IntelligenceCard`, not a lookalike that breaks the first time
 * something (e.g. `WhyDisclosure`'s relative-time formatting) calls a
 * `Date` method on it.
 */
function reviveCard(card: SnapshotCard): IntelligenceCard {
  return {
    ...card,
    sources: card.sources.map((source) => ({
      ...source,
      lastSyncedAt: new Date(source.lastSyncedAt),
    })),
    freshness: {
      ...card.freshness,
      asOf: new Date(card.freshness.asOf),
    },
    // `intelligenceCardSchema` infers `recommendedActions`/
    // `relatedFindingIds` as plain (mutable) arrays; the generic JSON-
    // revival mapped type makes every array `readonly`. Real values are
    // identical either way — this is just satisfying the schema-inferred
    // type's own shape. Assigned directly (not a conditional spread) since
    // a conditional spread's inferred type keeps the earlier `...card`
    // spread's `readonly` variant in the union even when this branch
    // would otherwise override it.
    recommendedActions: [...card.recommendedActions],
    relatedFindingIds: card.relatedFindingIds
      ? [...card.relatedFindingIds]
      : undefined,
  };
}

function matchesFilter(
  card: IntelligenceCard,
  filter: FilterDefinition,
): boolean {
  if (filter.field === "financialAmount") {
    const amountCents = card.financialContext?.amountCents ?? 0;
    const thresholdDollars =
      typeof filter.value === "number" ? filter.value : Number(filter.value);
    // Every other dollar->cents conversion in this codebase rounds
    // (connector mappers, update-business-profile.ts) — this one didn't,
    // so float imprecision (e.g. 0.55 * 100 === 55.00000000000001) could
    // silently exclude a card sitting exactly on the typed threshold from
    // a "show items over $X" filter (found by a deep audit, 2026-08-22).
    const thresholdCents = Math.round(thresholdDollars * 100);

    return filter.operator === "gte"
      ? amountCents >= thresholdCents
      : amountCents === thresholdCents;
  }

  if (filter.field === "severity") {
    return filter.operator === "eq" ? card.severity === filter.value : true;
  }

  if (filter.field === "text") {
    // Business Search's real deterministic match (Prompt 31,
    // docs/product-vision-backlog.md, ADR 0040) — a case-insensitive
    // substring match against the card's own title and summary, which
    // already carry the real entity name every capability puts there
    // (customer name, contact name, task name, goal name — see each
    // capability's own finding-building code). No separate entity search
    // query: this reuses exactly the cards already rendered.
    const haystack = `${card.title} ${card.summary}`.toLowerCase();
    return haystack.includes(String(filter.value).toLowerCase());
  }

  // field === "owner"
  return filter.operator === "eq" ? card.owner?.name === filter.value : true;
}

function applyFilters(
  cards: readonly IntelligenceCard[],
  filters: readonly FilterDefinition[],
): readonly IntelligenceCard[] {
  if (filters.length === 0) {
    return cards;
  }

  return cards.filter((card) =>
    filters.every((filter) => matchesFilter(card, filter)),
  );
}

const filterFieldLabel: Record<FilterDefinition["field"], string> = {
  financialAmount: "Value",
  severity: "Severity",
  owner: "Owner",
  text: "Search",
};

// Distinguishes genuine creations from idempotent replays (a re-run of
// "create a task for these" hits the same idempotency keys) so the
// message never overstates how many new tasks actually exist now.
function describeCommandTaskResult(
  created: number,
  alreadyExisted: number,
  failed: number,
): string {
  if (created === 0 && alreadyExisted === 0 && failed === 0) {
    return "No tasks were created.";
  }

  const parts: string[] = [];

  if (created > 0) {
    parts.push(`Created ${created} task${created === 1 ? "" : "s"}`);
  }

  if (alreadyExisted > 0) {
    parts.push(
      `${alreadyExisted} ${alreadyExisted === 1 ? "was" : "were"} already created`,
    );
  }

  if (failed > 0) {
    // Real gap found by review: this branch didn't exist at all — a
    // failed createTaskAction call was silently dropped, indistinguishable
    // from the user having selected zero targets. Mirrors
    // handleDraftForMatter's own count-based partial-failure reporting for
    // a batch operation, rather than concatenating each target's raw error
    // string.
    parts.push(`${failed} failed`);
  }

  return `${parts.join("; ")}.`;
}

function describeFilter(filter: FilterDefinition): string {
  if (filter.field === "text") {
    return `${filterFieldLabel.text}: "${filter.value}"`;
  }

  const operator = filter.operator === "gte" ? "≥" : "=";
  const value =
    filter.field === "financialAmount"
      ? `$${filter.value}`
      : String(filter.value);

  return `${filterFieldLabel[filter.field]} ${operator} ${value}`;
}

export function CommandCenterBoard({
  initialCards,
  createTaskAction,
  parseCommandAction,
  runAgentInvestigationAction,
  aiInvestigationAvailable,
  approveAgentActionProposalAction,
  dismissAgentActionProposalAction,
  simulateInvoicePaymentAction,
  recordCardFeedbackAction,
  approveMessageReplyProposalAction,
  draftMessageReplyAction,
  draftTaskNudgeAction,
  approveTaskNudgeProposalAction,
  draftTicketReplyAction,
  approveTicketReplyProposalAction,
  draftDealNoteAction,
  approveDealNoteProposalAction,
  draftInvoiceReminderAction,
  approveInvoiceReminderProposalAction,
}: {
  initialCards: readonly IntelligenceCard[];
  createTaskAction: CreateInternalTaskAction;
  parseCommandAction: ParseCommandAction;
  /**
   * Optional: absent when the Agent Fabric feature isn't wired in for this
   * deployment. When present, "investigate risk" in the command bar becomes
   * a real, business-wide investigation instead of an unrecognized command.
   */
  runAgentInvestigationAction?: RunAgentInvestigationAction;
  /** The real, live `isAgentFabricEnabled()` kill-switch state
   * (`_lib/agent-config.ts`), computed server-side — distinct from
   * `runAgentInvestigationAction` being wired at all: the action can be
   * present but the org-wide switch still off. Passed through to
   * `CommandBar` so that's surfaced proactively rather than only
   * discovered after typing "investigate" and getting a decline back. */
  aiInvestigationAvailable: boolean;
  approveAgentActionProposalAction?: ApproveAgentActionProposalAction;
  dismissAgentActionProposalAction?: DismissAgentActionProposalAction;
  simulateInvoicePaymentAction?: SimulateInvoicePaymentAction;
  recordCardFeedbackAction?: RecordCardFeedbackAction;
  approveMessageReplyProposalAction?: ApproveMessageReplyProposalAction;
  draftMessageReplyAction?: DraftMessageReplyAction;
  /** ADR 0057 — Asana's counterparts to the two props above. */
  draftTaskNudgeAction?: DraftTaskNudgeAction;
  approveTaskNudgeProposalAction?: ApproveTaskNudgeProposalAction;
  /** ADR 0057 — Zendesk's counterparts. */
  draftTicketReplyAction?: DraftTicketReplyAction;
  approveTicketReplyProposalAction?: ApproveTicketReplyProposalAction;
  /** ADR 0057 — HubSpot's counterparts. */
  draftDealNoteAction?: DraftDealNoteAction;
  approveDealNoteProposalAction?: ApproveDealNoteProposalAction;
  /** ADR 0057 — QuickBooks' counterparts. */
  draftInvoiceReminderAction?: DraftInvoiceReminderAction;
  approveInvoiceReminderProposalAction?: ApproveInvoiceReminderProposalAction;
}) {
  const router = useRouter();
  const [activeFilters, setActiveFilters] = useState<
    readonly FilterDefinition[]
  >([]);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Cards the Agent Fabric added this session — concatenated with
  // whichever deterministic card list is current (the server-rendered
  // initialCards until the first poll lands, the polled snapshot after)
  // rather than replacing them, since an investigation only ever adds one
  // reconciled recommendation on top of what the deterministic side
  // already showed. A poll tick never carries a prior agent investigation
  // result — that's real client-session state, not something
  // `getTodaysAttention` recomputes — so it's never a candidate for
  // replacement here.
  const [agentCards, setAgentCards] = useState<readonly IntelligenceCard[]>([]);
  const { snapshot: polledSnapshot, error: pollError } = useBusinessSnapshot({
    pollIntervalMs: POLL_INTERVAL_MS,
  });
  // The Work Mat's real step-progress view
  // (docs/adr/0063-agent-investigation-progress.md): set the instant
  // "investigate risk" fires (the client-generated id also becomes
  // runAgentInvestigationAction's own collaboration primary key), cleared
  // the instant that action resolves — investigationSteps polls for real
  // progress only in between.
  const [activeInvestigationId, setActiveInvestigationId] = useState<
    string | null
  >(null);
  const investigationSteps = useInvestigationSteps(activeInvestigationId);
  // "Draft for this Matter" batch trigger's own status per cluster key
  // (`groupCardsIntoClusters`'s `CardCluster.key`) — a plain client-side
  // in-flight/done marker, not persisted, mirroring how each individual
  // card's own draft button already tracks its own local pending state.
  const [matterDraftStatus, setMatterDraftStatus] = useState<
    Record<string, "pending" | "done">
  >({});

  // Shared by the "investigate risk" command-bar path and
  // draftMessageReplyAction's per-message "Draft a reply" button
  // (MessageFollowUpCard) — both produce one real agent_recommendation
  // card that needs to join this board's own session-added set the exact
  // same way.
  // Real bug found by review: this used to unconditionally clear
  // focusedCardId/activeFilters on every call — correct for a fresh
  // "investigate risk" command (a genuinely new, board-wide query that
  // should reset the view), but this same callback is also passed to
  // every per-card "Draft a reply/note/nudge/reminder" button and the
  // "Draft for this Matter" batch action, none of which should touch the
  // board's view state. A user who ran a filter command, then clicked
  // "Draft a reply" on one of the still-visible cards, had their filter
  // silently cleared and the whole board snap back to "show everything"
  // with no indication why. Split into the plain add-or-replace-the-card
  // update (used everywhere) and a separate view-resetting wrapper (used
  // only by the investigate command below).
  const handleAgentCardProduced = useCallback((newCard: IntelligenceCard) => {
    setAgentCards((current) => [
      ...current.filter((card) => card.id !== newCard.id),
      newCard,
    ]);
  }, []);

  const handleInvestigationCardProduced = useCallback(
    (newCard: IntelligenceCard) => {
      setFocusedCardId(null);
      setActiveFilters([]);
      handleAgentCardProduced(newCard);
    },
    [handleAgentCardProduced],
  );

  // Real gap found by review: this object literal (and, further down,
  // groupCardsIntoClusters/getBatchDraftableCards) recomputed on every
  // render regardless of whether the cards/actions behind them had
  // actually changed — including renders triggered by wholly unrelated
  // state (statusMessage, matterDraftStatus). Memoized here so those two
  // calls below can be memoized too, keyed on a stable dependency instead
  // of a fresh object reference every render.
  const draftActionsByEntityKind: DraftActionsByEntityKind = useMemo(
    () => ({
      ...(draftMessageReplyAction ? { message: draftMessageReplyAction } : {}),
      ...(draftInvoiceReminderAction
        ? { invoice: draftInvoiceReminderAction }
        : {}),
      ...(draftTaskNudgeAction ? { task: draftTaskNudgeAction } : {}),
      ...(draftDealNoteAction ? { lead: draftDealNoteAction } : {}),
      ...(draftTicketReplyAction
        ? { support_ticket: draftTicketReplyAction }
        : {}),
    }),
    [
      draftMessageReplyAction,
      draftInvoiceReminderAction,
      draftTaskNudgeAction,
      draftDealNoteAction,
      draftTicketReplyAction,
    ],
  );

  async function handleDraftForMatter(cluster: CardCluster) {
    setMatterDraftStatus((current) => ({
      ...current,
      [cluster.key]: "pending",
    }));

    // Deduped by real entity, not by card — a Matter can legitimately
    // group two different findings on the same entity (e.g. a lead with
    // both a follow_up_risk and an ownership_gap finding), and dispatching
    // once per card would fire the same draft action twice for the same
    // record, producing two near-duplicate drafts.
    const draftableCards = getBatchDraftableCards(
      cluster.cards,
      draftActionsByEntityKind,
    );

    const results = await Promise.all(
      draftableCards.map((card) =>
        dispatchDraftForCard(card, draftActionsByEntityKind),
      ),
    );

    for (const result of results) {
      if (result?.ok && result.card) {
        handleAgentCardProduced(result.card);
      }
    }

    setMatterDraftStatus((current) => ({ ...current, [cluster.key]: "done" }));

    const draftedCount = results.filter((result) => result?.ok).length;

    setStatusMessage(
      draftedCount === 0
        ? "Couldn't draft anything for this group. Try each item's own Draft button."
        : `Drafted ${draftedCount} of ${draftableCards.length} item${draftableCards.length === 1 ? "" : "s"} in this group — review each before approving.`,
    );
  }

  // Prefer the freshest polled cards once a poll has actually completed;
  // fall back to the real server-rendered set before that (never an empty
  // flash while the first background poll is still in flight).
  const deterministicCards = useMemo(
    () => polledSnapshot?.cards.map(reviveCard) ?? initialCards,
    [polledSnapshot, initialCards],
  );

  const allCards = useMemo(
    () => [...deterministicCards, ...agentCards],
    [deterministicCards, agentCards],
  );

  const visibleCards = useMemo(() => {
    if (focusedCardId) {
      return allCards.filter((card) => card.id === focusedCardId);
    }

    return applyFilters(allCards, activeFilters);
  }, [allCards, activeFilters, focusedCardId]);

  function clearView() {
    setActiveFilters([]);
    setFocusedCardId(null);
    setStatusMessage(null);
  }

  function handleSubmitCommand(text: string) {
    startTransition(async () => {
      const result = await parseCommandAction(text, visibleCards);

      if (!result.recognized) {
        setStatusMessage(
          `I didn't understand "${result.rawText}." Try a filter, a why question, or "create a task for these."`,
        );
        return;
      }

      const { intent } = result;

      if (intent.type === "filter") {
        setFocusedCardId(null);
        setActiveFilters(intent.filters);
        const matchCount = applyFilters(allCards, intent.filters).length;
        setStatusMessage(
          matchCount === 0
            ? "No cards match that filter right now."
            : `Showing ${matchCount} card${matchCount === 1 ? "" : "s"} matching that filter.`,
        );
        return;
      }

      if (intent.type === "investigate") {
        setActiveFilters([]);
        setFocusedCardId(intent.entityId);
        setStatusMessage(
          "Focused on that item. Ask again or clear to see everything.",
        );
        return;
      }

      if (
        intent.type === "propose_action" &&
        intent.actionType === "create_internal_task"
      ) {
        const targets = allCards.filter((card) =>
          intent.targets.includes(card.id),
        );
        let created = 0;
        let alreadyExisted = 0;
        let failed = 0;

        for (const card of targets) {
          const taskResult = await createTaskAction({
            title: buildTaskTitle("Follow up", card.title),
            sourceCardId: card.id,
            idempotencyKey: `command-task:${card.id}`,
          });

          if (taskResult.ok) {
            if (taskResult.task.created) {
              created += 1;
            } else {
              alreadyExisted += 1;
            }
          } else {
            failed += 1;
          }
        }

        setStatusMessage(
          describeCommandTaskResult(created, alreadyExisted, failed),
        );

        if (created > 0) {
          // Same gap CardActions' own router.refresh() closes: "Your
          // tasks" is server-rendered from data fetched before this
          // command ran, so a freshly created task needs a refresh to
          // actually appear there.
          router.refresh();
        }

        return;
      }

      if (intent.type === "agent_investigate") {
        if (!runAgentInvestigationAction) {
          setStatusMessage("AI investigation is not available.");
          return;
        }

        // Generated here, not by the server: this is what lets
        // investigationSteps start polling for real progress the instant
        // the action is fired, rather than only after it resolves (a
        // single-return-value Server Action has no earlier moment to hand
        // an id back).
        const investigationId = crypto.randomUUID();
        setActiveInvestigationId(investigationId);

        try {
          const investigation =
            await runAgentInvestigationAction(investigationId);

          if (!investigation.ok) {
            setStatusMessage(`Investigation failed. ${investigation.error}`);
            return;
          }

          if (investigation.card) {
            handleInvestigationCardProduced(investigation.card);
          }

          setStatusMessage(investigation.message);
          return;
        } finally {
          setActiveInvestigationId(null);
        }
      }

      setStatusMessage("That command isn't supported yet.");
    });
  }

  // Built once per render, not once per card in the cluster loop below —
  // renderCard's own `actionHandlers` parameter is identical for every
  // card `CommandCenterBoard` renders. Conditional spreads (not a plain
  // object literal) so an unwired action is genuinely absent from this
  // object, never present as an explicit `undefined` value, matching
  // `exactOptionalPropertyTypes`'s distinction between the two.
  const actionHandlers: CardActionHandlers = {
    onAgentCardProduced: handleAgentCardProduced,
    ...(approveAgentActionProposalAction
      ? { approveAgentActionProposalAction }
      : {}),
    ...(dismissAgentActionProposalAction
      ? { dismissAgentActionProposalAction }
      : {}),
    ...(simulateInvoicePaymentAction ? { simulateInvoicePaymentAction } : {}),
    ...(recordCardFeedbackAction ? { recordCardFeedbackAction } : {}),
    ...(approveMessageReplyProposalAction
      ? { approveMessageReplyProposalAction }
      : {}),
    ...(draftMessageReplyAction ? { draftMessageReplyAction } : {}),
    ...(draftTaskNudgeAction ? { draftTaskNudgeAction } : {}),
    ...(approveTaskNudgeProposalAction
      ? { approveTaskNudgeProposalAction }
      : {}),
    ...(draftTicketReplyAction ? { draftTicketReplyAction } : {}),
    ...(approveTicketReplyProposalAction
      ? { approveTicketReplyProposalAction }
      : {}),
    ...(draftDealNoteAction ? { draftDealNoteAction } : {}),
    ...(approveDealNoteProposalAction ? { approveDealNoteProposalAction } : {}),
    ...(draftInvoiceReminderAction ? { draftInvoiceReminderAction } : {}),
    ...(approveInvoiceReminderProposalAction
      ? { approveInvoiceReminderProposalAction }
      : {}),
  };

  // Both real computations, not just object bookkeeping — grouping
  // considers every pair of visible cards, and getBatchDraftableCards
  // dedupes by real entity — so recomputing them on every render
  // regardless of cause (a status message, a matter's own draft-pending
  // state) was real wasted work, not just noise. Memoized together so
  // draftableCards is looked up per cluster below, not recomputed inline.
  const clusters = useMemo(
    () =>
      groupCardsIntoClusters(visibleCards).map((cluster) => ({
        cluster,
        draftableCards: getBatchDraftableCards(
          cluster.cards,
          draftActionsByEntityKind,
        ),
      })),
    [visibleCards, draftActionsByEntityKind],
  );

  return (
    <>
      <CommandBar
        isPending={isPending}
        statusMessage={statusMessage}
        onSubmitCommand={handleSubmitCommand}
        aiInvestigationAvailable={aiInvestigationAvailable}
      />

      {/* The Work Mat's real step-by-step progress
          (docs/adr/0063-agent-investigation-progress.md) — one agent
          identity's own quiet, business-language steps, never a raw
          tool-call log or named specialist identities (ADR 0020). Shown
          only while activeInvestigationId is set (between firing the
          command and that action resolving) and only once the first real
          step row has actually landed — never a fabricated placeholder
          list. */}
      {activeInvestigationId && investigationSteps.length > 0 ? (
        <ul className="workMatSteps" aria-label="Investigation progress">
          {investigationSteps.map((step) => (
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

      {pollError ? (
        <p className="liveStatusNotice liveStatusNotice-paused" role="status">
          Live updates paused
          {polledSnapshot
            ? ` — showing cards as of ${formatRelativeTime(new Date(polledSnapshot.generatedAt), new Date())}.`
            : " — showing the data from when this page loaded."}
        </p>
      ) : polledSnapshot ? (
        <p className="liveStatusNotice" role="status">
          Cards updated{" "}
          {formatRelativeTime(new Date(polledSnapshot.generatedAt), new Date())}
          .
        </p>
      ) : null}

      {focusedCardId || activeFilters.length > 0 ? (
        <div className="activeViewBar" role="status">
          <div className="activeViewChips">
            {focusedCardId ? (
              <span className="filterChip">Focused on 1 item</span>
            ) : (
              activeFilters.map((filter, index) => (
                <span className="filterChip" key={index}>
                  {describeFilter(filter)}
                </span>
              ))
            )}
          </div>
          <Button
            variant="ghost"
            className="clearViewButton"
            onClick={clearView}
          >
            Show all cards
          </Button>
        </div>
      ) : null}

      {visibleCards.length === 0 ? (
        <p className="noCardsMessage">
          {allCards.length === 0
            ? "No cards need your attention right now."
            : "Nothing matches the current view."}
        </p>
      ) : (
        <div className="dynamicCardStack">
          {clusters.map(({ cluster, draftableCards }) => {
            const renderedCards = cluster.cards.map((card) =>
              renderCard(card, createTaskAction, actionHandlers),
            );

            if (cluster.cards.length < 2) {
              return renderedCards[0];
            }

            const draftStatus = matterDraftStatus[cluster.key];

            return (
              <section className="matterGroup" key={cluster.key}>
                <div className="matterGroupHeader">
                  <p>
                    Possibly the same situation — {cluster.cards.length} related
                    items
                  </p>
                  {draftableCards.length >= 2 ? (
                    <Button
                      variant="ghost"
                      className="matterGroupDraftButton"
                      disabled={draftStatus === "pending"}
                      onClick={() => handleDraftForMatter(cluster)}
                    >
                      {draftStatus === "pending"
                        ? "Drafting…"
                        : draftStatus === "done"
                          ? "Drafted — review below"
                          : `Draft for all ${draftableCards.length}`}
                    </Button>
                  ) : null}
                </div>
                {renderedCards}
              </section>
            );
          })}
        </div>
      )}

      <RecentActivityPanel
        recentActions={polledSnapshot?.recentActions ?? []}
        now={new Date()}
      />
    </>
  );
}
