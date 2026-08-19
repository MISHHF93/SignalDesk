import {
  parseDashboardIntent,
  type DashboardIntent,
} from "@business-dashboard/schemas";

import type { AIProvider, DashboardCommandContext } from "./ai-provider";

const MAX_COMMAND_LENGTH = 300;

export type ParseCommandResult =
  | { readonly recognized: true; readonly intent: DashboardIntent }
  | { readonly recognized: false; readonly rawText: string };

/**
 * Validates raw command-bar text, asks the provider to structure it, and
 * validates the result against `dashboardIntentSchema` before it can affect
 * the dashboard. This is the "Claude controls composition, not arbitrary
 * code" boundary — an invalid or unrecognized result is abstention
 * (`recognized: false`), never a guess.
 */
export async function parseCommand(
  provider: AIProvider,
  rawText: string,
  context?: DashboardCommandContext,
): Promise<ParseCommandResult> {
  const trimmed = rawText.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_COMMAND_LENGTH) {
    return { recognized: false, rawText: trimmed };
  }

  try {
    const intent = await provider.generateStructured<DashboardIntent>({
      task: "parse_dashboard_command",
      prompt: trimmed,
      ...(context ? { context } : {}),
      parse: parseDashboardIntent,
    });

    return { recognized: true, intent };
  } catch {
    return { recognized: false, rawText: trimmed };
  }
}
