"use server";

import type { ParseCommandResult } from "@business-dashboard/application";
import type { IntelligenceCard } from "@business-dashboard/schemas";

import { businessAIOrchestrator } from "../_lib/orchestrator";
import { getCurrentOrganization } from "../_lib/session";

/**
 * Server-side command-bar entry point: routes through the single Business
 * AI Node (per README's AI orchestration section) rather than calling a
 * provider directly, and keeps the client bundle free of provider logic.
 *
 * This does no database I/O itself, but a Server Action is an independently
 * callable HTTP endpoint regardless of which page renders its trigger (see
 * `signInWithOAuthAction`'s doc comment on the same point) — the real
 * command center at `/` already requires a session before it ever renders
 * the command bar, so this re-checks rather than trusting that.
 */
export async function parseCommandAction(
  rawText: string,
  visibleCards: readonly IntelligenceCard[],
): Promise<ParseCommandResult> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { recognized: false, rawText: rawText.trim() };
  }

  return businessAIOrchestrator.interpretCommand(rawText, visibleCards);
}
