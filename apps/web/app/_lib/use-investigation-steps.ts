"use client";

import { useEffect, useState } from "react";

export type InvestigationStepStatus = "pending" | "running" | "done" | "failed";

export interface InvestigationStepView {
  readonly stepIndex: number;
  readonly label: string;
  readonly status: InvestigationStepStatus;
}

interface StepsResponse {
  readonly status: "running" | "completed" | "failed";
  readonly steps: readonly InvestigationStepView[];
}

// Real gap found by review: the deterministic specialist (zero-cost,
// zero network calls, always available with no ANTHROPIC_API_KEY — the
// common case) completes a whole investigation end to end in as little
// as ~500-600ms. At a slower interval, the first poll (fired immediately,
// before the server has even created the collaboration row yet) reliably
// 404s, and a second poll never gets a chance to land before
// activeInvestigationId is already cleared — the step list never shows
// anything in the fast path. 200ms narrows that gap considerably (still
// comfortably covers a real model-backed call's several-second duration
// with many polls to spare) — honestly disclosed limitation: an
// investigation fast enough to finish before even one poll lands (a real,
// observed case in this environment) simply shows nothing, the same way
// it always has, rather than a broken or stuck progress view.
const POLL_INTERVAL_MS = 200;

/**
 * The Work Mat's real, incrementally-updated progress view
 * (docs/adr/0063-agent-investigation-progress.md) — plain-interval polling
 * of `GET /api/agents/investigations/[id]/steps`, the same established
 * mechanism `useBusinessSnapshot` already uses, not a new transport.
 * `collaborationId` is the id the caller already generated client-side
 * before firing `runAgentInvestigationAction`, so polling can start the
 * same instant, independent of that action's own single, end-of-run return
 * value. Pass `null` to stop polling (e.g. once the action itself
 * resolves) — this hook never decides on its own when the investigation is
 * "done"; the caller's own awaited action result is still the source of
 * truth for the final card.
 */
export function useInvestigationSteps(
  collaborationId: string | null,
): readonly InvestigationStepView[] {
  const [steps, setSteps] = useState<readonly InvestigationStepView[]>([]);

  useEffect(() => {
    if (!collaborationId) {
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(
          `/api/agents/investigations/${collaborationId}/steps`,
        );

        if (!response.ok || cancelled) {
          return;
        }

        const data = (await response.json()) as StepsResponse;

        if (!cancelled) {
          setSteps(data.steps);
        }
      } catch {
        // A missed poll tick is never fatal — the next tick (or the
        // action's own final result) recovers. Nothing to show the user
        // for one dropped progress read.
      }
    }

    void poll();
    const intervalId = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [collaborationId]);

  // Derived, not stored: a null id always reads as no steps, regardless of
  // whatever the previous investigation's `steps` state still holds — the
  // effect above only ever writes `steps` for a real, non-null id, so there
  // is no separate reset branch to keep in sync with this one.
  return collaborationId ? steps : [];
}
