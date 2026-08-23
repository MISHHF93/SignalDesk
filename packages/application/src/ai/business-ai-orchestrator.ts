import type {
  IntelligenceContext,
  PrioritizedFinding,
} from "@signaldesk/intelligence";
import {
  applyAttentionAdmission,
  prioritizeFindings,
  runIntelligenceCapabilities,
} from "@signaldesk/intelligence";
import type { IntelligenceCard } from "@signaldesk/schemas";

import { composeCards } from "../cards/dashboard-composition";
import type { AIProvider, DashboardCommandContext } from "./ai-provider";
import { parseCommand, type ParseCommandResult } from "./parse-command";

export interface BusinessAttention {
  /** Every real finding, prioritized — including ones admission deferred.
   * Callers that need the complete picture (metrics, exports, the Daily
   * Brief) should read this, not `cards`. */
  readonly findings: readonly PrioritizedFinding[];
  /** Only the admitted findings, composed into cards — see
   * `applyAttentionAdmission` (`@signaldesk/intelligence`) for why this is
   * capped rather than one card per finding. */
  readonly cards: readonly IntelligenceCard[];
  /** How many real, prioritized findings exist below the admission cap —
   * `0` when everything fit. Never silently dropped: a caller surfacing
   * `cards` should also surface this count, honestly, rather than letting
   * the cap look like "nothing else needs attention." */
  readonly deferredCount: number;
}

export interface BusinessAIOrchestrator {
  /**
   * Runs the Intelligence Core, prioritizes what it finds, and composes the
   * result into cards for the one-page command center. This is the single
   * place that decides what the user sees — capabilities only ever produce
   * evidence (see `@signaldesk/intelligence`).
   */
  getAttention(context: IntelligenceContext): Promise<BusinessAttention>;
  /**
   * The Command Bar's only entry point: natural-language text is understood
   * here, through the same node that reasons about the rest of the
   * business, never parsed ad hoc elsewhere in the app.
   */
  interpretCommand(
    text: string,
    visibleCards: readonly IntelligenceCard[],
  ): Promise<ParseCommandResult>;
}

export interface BusinessAIOrchestratorDependencies {
  readonly provider: AIProvider;
}

export function createBusinessAIOrchestrator(
  dependencies: BusinessAIOrchestratorDependencies,
): BusinessAIOrchestrator {
  return {
    async getAttention(
      context: IntelligenceContext,
    ): Promise<BusinessAttention> {
      const findings = await runIntelligenceCapabilities(context);
      const prioritized = prioritizeFindings(findings);
      const { admitted, deferredCount } = applyAttentionAdmission(prioritized);
      const cards = composeCards(admitted);

      return { findings: prioritized, cards, deferredCount };
    },

    async interpretCommand(
      text: string,
      visibleCards: readonly IntelligenceCard[],
    ): Promise<ParseCommandResult> {
      const context: DashboardCommandContext = { visibleCards };

      return parseCommand(dependencies.provider, text, context);
    },
  };
}
