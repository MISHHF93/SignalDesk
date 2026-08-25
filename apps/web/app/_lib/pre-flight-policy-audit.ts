/**
 * A real, deterministic validation gate every draft-then-approve write
 * action (ADR 0056/0057) runs against its drafted content immediately
 * before the external send — independent of, and in addition to, the
 * existing kill-switch/evidence-staleness/rate-limit checks each approve
 * action already applies. Pure and synchronous: no AI call, no DB access.
 * "Does deterministic logic suffice before reaching for AI" (this repo's
 * own per-feature checklist, `CLAUDE.md`) answers yes here — every check
 * below is a fact this app can already verify against data it already has,
 * not a judgment call that needs a model.
 *
 * Deliberately scoped to checks that are honestly implementable with zero
 * new schema and zero new config: a delimiter-boundary leak (defense in
 * depth behind `neutralizeDelimiterEscapes`, `claude-provider.ts`, in case
 * untrusted source text ever reaches a draft unescaped), a drafted dollar
 * figure that doesn't match the real amount on record (catches a
 * hallucinated number before a customer sees it), and a duplicate send to
 * the same entity within 24 hours (catches an accidental double-message).
 * A recipient-domain allowlist and a refund/discount ceiling are
 * explicitly not built here — this app has no stored allowlist or
 * per-org policy config to check against yet, and every write today can
 * only ever target the entity's own on-file counterparty (the connector
 * clients have no "arbitrary recipient" parameter at all), so there is no
 * real data to validate a recipient check against without inventing
 * config first.
 */

export interface PolicyViolation {
  readonly code: "delimiter_leak" | "amount_mismatch" | "duplicate_send_window";
  readonly message: string;
}

export interface PolicyAuditResult {
  readonly passed: boolean;
  readonly violations: readonly PolicyViolation[];
}

export interface PolicyAuditInput {
  readonly draftedContent: {
    readonly subject?: string | undefined;
    readonly body: string;
  };
  /** The real amount this drafted content is about, in cents — present
   * only for entities that carry one (an invoice reminder does; a task
   * nudge, deal note, or ticket reply do not). `undefined` skips the
   * amount check entirely rather than treating "no amount" as a
   * mismatch. */
  readonly expectedAmountCents?: number | undefined;
  /** When a `sent` row already exists for this same entity, its
   * timestamp — `null`/`undefined` when none does (or none within any
   * window worth considering). */
  readonly mostRecentSentAt?: Date | null | undefined;
}

const UNTRUSTED_DATA_OPEN_TAG = "<untrusted_business_data>";
const UNTRUSTED_DATA_CLOSE_TAG = "</untrusted_business_data>";
const DUPLICATE_SEND_WINDOW_MS = 24 * 60 * 60 * 1000;
// A drafted dollar figure is allowed to round the real amount to the
// nearest whole dollar (models often drop cents in prose) — anything
// beyond a dollar of slack is a real mismatch, not formatting noise.
const AMOUNT_MISMATCH_TOLERANCE_CENTS = 100;

/**
 * Finds every `$1,234.56`-shaped figure in free text and returns each as
 * integer cents — the same direction every other money field in this
 * codebase already stores in (`Invoice.amountCents`, ...). Text with no
 * dollar figure at all returns `[]` — this function itself makes no
 * judgment about whether that's a problem; `runPreFlightPolicyAudit`'s
 * caller decides that by whether it passed an `expectedAmountCents` at
 * all (task nudges/deal notes with no real amount never do, so an empty
 * result there is correctly a non-issue; an invoice reminder always does,
 * so an empty result there correctly is one).
 */
export function extractDollarAmountsCents(text: string): readonly number[] {
  const amounts: number[] = [];

  // The comma-grouped branch requires at least one real `,ddd` group
  // (`+`, not `*`) — with `*` (0-or-more), a comma-less large figure like
  // "$1234567" matched that branch on its first 1-3 digits alone ("123"),
  // silently truncating the rest instead of falling through to the
  // plain-digits branch below. Found reviewing this file after it shipped:
  // that truncation would falsely flag a correct large-dollar draft (e.g.
  // a $1,234,567 invoice reminder written without thousands separators) as
  // an "amount mismatch" and wrongly block a legitimate send.
  for (const match of text.matchAll(
    /\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
  )) {
    const raw = match[1];

    if (!raw) {
      continue;
    }

    const dollars = Number(raw.replace(/,/g, ""));

    if (Number.isFinite(dollars)) {
      amounts.push(Math.round(dollars * 100));
    }
  }

  return amounts;
}

export function runPreFlightPolicyAudit(
  input: PolicyAuditInput,
): PolicyAuditResult {
  const violations: PolicyViolation[] = [];
  const combinedText = `${input.draftedContent.subject ?? ""}\n${input.draftedContent.body}`;

  if (
    combinedText.includes(UNTRUSTED_DATA_OPEN_TAG) ||
    combinedText.includes(UNTRUSTED_DATA_CLOSE_TAG)
  ) {
    violations.push({
      code: "delimiter_leak",
      message:
        "The drafted content contains a raw data-boundary marker — a sign that untrusted source text leaked through instead of being drafted from. Blocked before it could reach a customer.",
    });
  }

  if (input.expectedAmountCents !== undefined) {
    const draftedAmounts = extractDollarAmountsCents(combinedText);
    // `[].every(...)` is vacuously true — deliberately relied on, not an
    // oversight: an amount-bearing entity's draft that mentions zero
    // dollar figures at all is exactly as much a problem as one that
    // mentions a wrong figure (the model omitted the one fact this
    // content exists to state), so it must fail this check the same way.
    // Found reviewing this file: an earlier `draftedAmounts.length > 0 &&`
    // guard suppressed that vacuous-true case, silently passing a
    // reminder that names no amount at all — the review this check was
    // supposedly built to do, treated as "nothing to check" instead.
    const noAmountMatches = draftedAmounts.every(
      (cents) =>
        Math.abs(cents - input.expectedAmountCents!) >
        AMOUNT_MISMATCH_TOLERANCE_CENTS,
    );

    if (noAmountMatches) {
      const expected = (input.expectedAmountCents / 100).toFixed(2);
      violations.push({
        code: "amount_mismatch",
        message:
          draftedAmounts.length === 0
            ? `The drafted content doesn't state a dollar amount at all — the real amount on record is $${expected}. Blocked to avoid sending a reminder that never says how much is owed.`
            : `The drafted content's dollar figure doesn't match the real amount on record ($${expected}). Blocked to avoid sending the wrong amount to a customer.`,
      });
    }
  }

  if (input.mostRecentSentAt) {
    const elapsedMs = Date.now() - input.mostRecentSentAt.getTime();

    if (elapsedMs < DUPLICATE_SEND_WINDOW_MS) {
      const elapsedHours = Math.max(
        0,
        Math.round(elapsedMs / (60 * 60 * 1000)),
      );

      violations.push({
        code: "duplicate_send_window",
        message: `A message was already sent for this item ${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago. Blocked to avoid double-messaging the same customer within 24 hours.`,
      });
    }
  }

  return { passed: violations.length === 0, violations };
}
