import { CONFIDENCE_DETERMINISTIC_RULE } from "@signaldesk/intelligence";
import { EXPOSURE_TYPE_LABEL, type ExposureType } from "@signaldesk/semantics";

import type {
  AgentInterpretationContext,
  AIProvider,
  DashboardCommandContext,
  DealNoteDraftContext,
  GenerateStructuredInput,
  InvoiceReminderDraftContext,
  MessageReplyDraftContext,
  StructuredGenerationTask,
  TaskNudgeDraftContext,
  TicketReplyDraftContext,
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

/**
 * Business Search's one real deterministic path (Prompt 31,
 * docs/product-vision-backlog.md, ADR 0040) — an explicit "search"/"find"
 * command, never a bare word (a bare word is ambiguous with ordinary
 * command-bar prose the other matchers might still want first crack at,
 * hence this runs last in `matchDashboardCommand` below). The query text
 * itself is returned as-is; matching against real card fields happens
 * client-side (`command-center-board.tsx`'s `matchesFilter`), the same
 * split every other filter already uses.
 */
function matchFilterByText(prompt: string): unknown | null {
  const match = /^(?:search|find)\s+(?:for\s+)?(.+)/i.exec(prompt.trim());
  const query = match?.[1]?.trim();

  if (!query) {
    return null;
  }

  return {
    type: "filter",
    filters: [{ field: "text", operator: "contains", value: query }],
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

function matchAgentInvestigate(prompt: string): unknown | null {
  // Distinct anchor from matchInvestigate's `/^why\b/i` above: "why" focuses
  // one already-rendered card client-side, while this triggers the Agent
  // Fabric's real, business-wide, server-side collaboration
  // (run-agent-investigation.ts, apps/web/app/_actions) — the two must
  // never collide on the same phrase.
  if (!/^investigate\b/i.test(prompt.trim())) {
    return null;
  }

  return { type: "agent_investigate" };
}

function matchDashboardCommand(
  prompt: string,
  context: DashboardCommandContext | undefined,
): unknown {
  return (
    matchInvestigate(prompt, context) ??
    matchAgentInvestigate(prompt) ??
    matchCreateTask(prompt, context) ??
    matchFilterBySeverity(prompt) ??
    matchFilterByAmount(prompt) ??
    matchFilterByText(prompt) ?? { type: "unrecognized" }
  );
}

/**
 * Templates one specialist's claims directly from the real findings it was
 * given — never invents a fact the findings don't already carry, per the
 * Agent Fabric's "mustNotInventFacts" constraint. This is what makes
 * "deterministic-specialist" a genuine, always-available second agent (see
 * AGENT_REGISTRY) rather than a stub waiting on a paid model key: zero
 * network calls, same doctrine as daily-brief.ts's deterministic assembly.
 */
function interpretFindingsDeterministically(
  context: AgentInterpretationContext | undefined,
): unknown {
  const findings = context?.findings ?? [];

  if (findings.length === 0) {
    return { claims: [], confidence: CONFIDENCE_DETERMINISTIC_RULE };
  }

  const claims = findings.map((finding) => finding.summary);

  // Grouped by (exposureType, currency), never blended into one total: a
  // "Pipeline value" (POTENTIAL_EXPOSURE) figure and an "Overdue
  // receivable" (OUTSTANDING_AMOUNT) figure are different financial claims,
  // and summing them would misstate both — the same rule
  // agent-result-reconciler.ts already enforces for agent-authored results
  // ("distinct financial categories must never be summed into one
  // misleading total figure").
  const exposureTotals = new Map<
    string,
    { exposureType: ExposureType; currency: string; amountCents: number }
  >();

  for (const finding of findings) {
    if (!finding.financialContext) {
      continue;
    }

    const { exposureType, currency, amountCents } = finding.financialContext;
    const key = `${exposureType}:${currency}`;
    const existing = exposureTotals.get(key);

    if (existing) {
      existing.amountCents += amountCents;
    } else {
      exposureTotals.set(key, { exposureType, currency, amountCents });
    }
  }

  const exposure = Array.from(exposureTotals.values())
    .filter((total) => total.amountCents > 0)
    .map(
      (total) =>
        ` ${EXPOSURE_TYPE_LABEL[total.exposureType]}: ${(total.amountCents / 100).toLocaleString("en-CA", { style: "currency", currency: total.currency, maximumFractionDigits: 0 })}.`,
    )
    .join("");

  return {
    claims,
    recommendation: `Review the ${findings.length} affected item${findings.length === 1 ? "" : "s"}.${exposure}`,
    confidence: CONFIDENCE_DETERMINISTIC_RULE,
  };
}

/**
 * Templates a generic, non-committal acknowledgement — never echoes
 * `inboundBodyText` back (it is untrusted customer text; reflecting it into
 * an outbound reply this provider fully controls would be a real, if low-
 * severity, injection surface) and never invents a substantive answer to
 * the customer's actual question. This is what keeps `draft_customer_reply`
 * a genuine, always-available capability (see AGENT_REGISTRY) rather than a
 * stub gated on ANTHROPIC_API_KEY.
 */
function draftMessageReplyDeterministically(
  context: MessageReplyDraftContext | undefined,
): unknown {
  const subject = context?.subject ?? "";
  const greeting = context?.counterpartyName
    ? `Hi ${context.counterpartyName},`
    : "Hi,";

  return {
    subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
    body: `${greeting}\n\nThanks for your message. We're looking into this and will follow up shortly.\n\nBest regards`,
  };
}

/**
 * Templates a generic reminder from already-verified structured figures
 * only (amount/due date/days overdue) — these are this app's own computed
 * numbers, not untrusted free text, so referencing them directly (unlike
 * `inboundBodyText`) carries no injection risk.
 */
function draftInvoiceReminderDeterministically(
  context: InvoiceReminderDraftContext | undefined,
): unknown {
  const greeting = context?.customerName
    ? `Hi ${context.customerName},`
    : "Hi,";
  const amount =
    context !== undefined
      ? (context.amountCents / 100).toLocaleString("en-CA", {
          style: "currency",
          currency: context.currency,
          maximumFractionDigits: 2,
        })
      : "the outstanding amount";
  const daysOverdue = context?.daysOverdue ?? 0;

  return {
    subject: `Payment reminder: invoice ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`,
    body: `${greeting}\n\nThis is a friendly reminder that an invoice for ${amount} is now ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} past due. Please let us know if you have any questions or if payment is already in progress.\n\nBest regards`,
  };
}

/** Body-only (no subject) — never echoes untrusted task/assignee text back
 * beyond a plain name reference, mirroring `draftMessageReplyDeterministically`. */
function draftTaskNudgeDeterministically(
  context: TaskNudgeDraftContext | undefined,
): unknown {
  const who = context?.assigneeName ? ` ${context.assigneeName}` : "";
  const daysOverdue = context?.daysOverdue ?? 0;

  return {
    body: `Checking in${who} — this task is now ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} past its due date. Could you share a quick status update?`,
  };
}

/** Body-only — templates from already-verified structured deal fields only. */
function draftDealNoteDeterministically(
  context: DealNoteDraftContext | undefined,
): unknown {
  const contactName = context?.contactName ?? "this contact";
  const stage = context?.stage ?? "its current stage";
  const lastInteraction = context?.lastInteractionAt
    ? context.lastInteractionAt.toISOString().slice(0, 10)
    : "no recorded date";

  return {
    body: `No recent activity logged for ${contactName} (currently in ${stage}). Last interaction: ${lastInteraction}. Recommend a follow-up to confirm status.`,
  };
}

/**
 * Templates a generic, non-committal acknowledgement — never echoes
 * `recentComments` back (real customer-authored text, the same injection
 * surface `inboundBodyText` is for Gmail replies) and never invents a
 * substantive answer to the customer's actual question.
 */
function draftTicketReplyDeterministically(
  context: TicketReplyDraftContext | undefined,
): unknown {
  const greeting = context?.requesterName
    ? `Hi ${context.requesterName},`
    : "Hi,";

  return {
    body: `${greeting}\n\nThanks for the update. We're looking into this and will follow up shortly.\n\nBest regards`,
  };
}

interface DeterministicTaskConfig {
  readonly draft: (context: unknown) => unknown;
}

/**
 * One entry per deterministic draft task — replaces what would otherwise be
 * a growing `if` chain, mirroring claude-provider.ts's `TASK_PROMPTS` lookup
 * table for the same reason. `interpret_findings` and
 * `parse_dashboard_command` keep their own dedicated branches below since
 * their shapes (and `parse_dashboard_command`'s prompt-based matching) don't
 * fit this same "draft from a context object" shape.
 */
const DETERMINISTIC_DRAFT_TASKS: Partial<
  Record<StructuredGenerationTask, DeterministicTaskConfig>
> = {
  draft_message_reply: {
    draft: (context) =>
      draftMessageReplyDeterministically(
        context as MessageReplyDraftContext | undefined,
      ),
  },
  draft_invoice_reminder: {
    draft: (context) =>
      draftInvoiceReminderDeterministically(
        context as InvoiceReminderDraftContext | undefined,
      ),
  },
  draft_task_nudge: {
    draft: (context) =>
      draftTaskNudgeDeterministically(
        context as TaskNudgeDraftContext | undefined,
      ),
  },
  draft_deal_note: {
    draft: (context) =>
      draftDealNoteDeterministically(
        context as DealNoteDraftContext | undefined,
      ),
  },
  draft_ticket_reply: {
    draft: (context) =>
      draftTicketReplyDeterministically(
        context as TicketReplyDraftContext | undefined,
      ),
  },
};

/**
 * A rule-based `AIProvider`: no external model call, no API key, no cost,
 * fully deterministic. This is the first-slice implementation behind the
 * `AIProvider` interface; a model-backed provider (Claude) sits behind the
 * same interface (see `claude-provider.ts`) once `ANTHROPIC_API_KEY` is
 * configured. Unrecognized `parse_dashboard_command` input is never guessed
 * at — it produces a raw shape that `parseDashboardIntent` rejects, so
 * callers can show an honest "I didn't understand that" rather than a wrong
 * action.
 */
export function createDeterministicProvider(): AIProvider {
  return {
    // Declared `async` deliberately: every AIProvider method must return a
    // rejected Promise on failure, never throw synchronously, so callers can
    // always `await`/`.catch()` uniformly regardless of implementation.
    async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T> {
      if (input.task === "interpret_findings") {
        const raw = interpretFindingsDeterministically(
          input.context as AgentInterpretationContext | undefined,
        );

        return input.parse(raw);
      }

      const draftTask = DETERMINISTIC_DRAFT_TASKS[input.task];

      if (draftTask) {
        const raw = draftTask.draft(input.context);

        return input.parse(raw);
      }

      if (input.task !== "parse_dashboard_command") {
        throw new Error(
          `Unsupported structured generation task: ${input.task}`,
        );
      }

      const raw = matchDashboardCommand(
        input.prompt,
        input.context as DashboardCommandContext | undefined,
      );

      return input.parse(raw);
    },
  };
}
