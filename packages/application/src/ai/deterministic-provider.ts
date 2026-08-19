import type {
  AIProvider,
  DashboardCommandContext,
  GenerateStructuredInput,
} from "./ai-provider";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "at",
  "risk",
  "for",
  "of",
  "with",
]);

function significantWords(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function matchFilterByAmount(prompt: string): unknown | null {
  // `\b` before "over" is required — without it this also matches inside
  // "leftover $10,000", "carryover $5,000", "rollover $2,500", or
  // "moreover $500", none of which are a filter command.
  const match = /\bover\s+\$?([\d,]+(?:\.\d+)?)/i.exec(prompt);

  if (!match) {
    return null;
  }

  const value = Number(match[1]!.replace(/,/g, ""));

  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    type: "filter",
    filters: [{ field: "financialAmount", operator: "gte", value }],
  };
}

function matchFilterBySeverity(prompt: string): unknown | null {
  // Deliberately requires "show"/"items" around the severity word, not a
  // bare "only <severity>" — that standalone pattern matched inside
  // ordinary sentences like "the only high-value deal we have" or "our
  // only critical client," silently applying a filter no one asked for.
  const match =
    /\bshow\s+(?:only\s+)?(critical|high|medium|low)(?:\s+priority)?\s+items?\b/i.exec(
      prompt,
    );

  const severity = match?.[1];

  if (!severity) {
    return null;
  }

  return {
    type: "filter",
    filters: [
      { field: "severity", operator: "eq", value: severity.toLowerCase() },
    ],
  };
}

function matchInvestigate(
  prompt: string,
  context: DashboardCommandContext | undefined,
): unknown | null {
  if (!/^why\b/i.test(prompt.trim())) {
    return null;
  }

  const promptWords = new Set(significantWords(prompt));
  const card = context?.visibleCards.find((candidate) =>
    significantWords(candidate.title).some((word) => promptWords.has(word)),
  );

  if (!card) {
    return null;
  }

  return { type: "investigate", entityId: card.id };
}

function matchCreateTask(
  prompt: string,
  context: DashboardCommandContext | undefined,
): unknown | null {
  if (!/\bcreate\s+(?:a\s+|an\s+)?(?:internal\s+)?tasks?\b/i.test(prompt)) {
    return null;
  }

  const targets = context?.visibleCards.map((card) => card.id) ?? [];

  if (targets.length === 0) {
    return null;
  }

  return {
    type: "propose_action",
    actionType: "create_internal_task",
    targets,
  };
}

function matchDashboardCommand(
  prompt: string,
  context: DashboardCommandContext | undefined,
): unknown {
  return (
    matchInvestigate(prompt, context) ??
    matchCreateTask(prompt, context) ??
    matchFilterBySeverity(prompt) ??
    matchFilterByAmount(prompt) ?? { type: "unrecognized" }
  );
}

/**
 * A rule-based `AIProvider`: no external model call, no API key, no cost,
 * fully deterministic. This is the first-slice implementation behind the
 * `AIProvider` interface; a model-backed provider (Claude) is a planned
 * fast-follow once an evaluation harness exists (see README's AI
 * orchestration section). Unrecognized input is never guessed at — it
 * produces a raw shape that `parseDashboardIntent` rejects, so callers can
 * show an honest "I didn't understand that" rather than a wrong action.
 */
export function createDeterministicProvider(): AIProvider {
  return {
    // Declared `async` deliberately: every AIProvider method must return a
    // rejected Promise on failure, never throw synchronously, so callers can
    // always `await`/`.catch()` uniformly regardless of implementation.
    async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T> {
      if (input.task !== "parse_dashboard_command") {
        throw new Error(
          `Unsupported structured generation task: ${input.task}`,
        );
      }

      const raw = matchDashboardCommand(input.prompt, input.context);

      return input.parse(raw);
    },
  };
}
