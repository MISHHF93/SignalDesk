import type {
  IntelligenceContext,
  PrioritizedFinding,
} from "@business-dashboard/intelligence";
import {
  prioritizeFindings,
  runIntelligenceCapabilities,
} from "@business-dashboard/intelligence";
import type { IntelligenceCard } from "@business-dashboard/schemas";

import { composeCards } from "../cards/dashboard-composition";
import type { AIProvider, DashboardCommandContext } from "./ai-provider";
import { parseCommand, type ParseCommandResult } from "./parse-command";

export interface BusinessAttention {
  readonly findings: readonly PrioritizedFinding[];
  readonly cards: readonly IntelligenceCard[];
}

export interface BusinessAIOrchestrator {
  /**
   * Runs the Intelligence Core, prioritizes what it finds, and composes the
   * result into cards for the one-page command center. This is the single
   * place that decides what the user sees — capabilities only ever produce
   * evidence (see `@business-dashboard/intelligence`).
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
      const cards = composeCards(prioritized);

      return { findings: prioritized, cards };
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
