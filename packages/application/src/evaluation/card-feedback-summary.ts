/**
 * A first real, narrow slice of the "SignalDesk Evaluation Lab" proposal
 * (Prompt 13, `docs/product-vision-backlog.md`, ADR 0033) — not the
 * versioned-dataset/Champion-Challenger/regression-gate engine that
 * proposal describes (that genuinely needs real production AI usage
 * volume to mean anything, per that entry's own reality check), just a
 * real, deterministic aggregate over `card_feedback` (ADR 0032's real
 * feedback-capture table). Unlike AI-quality evaluation, this metric is
 * meaningful the moment a single feedback row exists — it doesn't need
 * volume to calibrate against, only to arithmetic over.
 */

export interface CardFeedbackEntry {
  readonly cardType: string;
  readonly feedback: "useful" | "not_relevant";
}

export interface CardTypeFeedbackSummary {
  readonly cardType: string;
  readonly usefulCount: number;
  readonly notRelevantCount: number;
  /** `null` when no feedback exists yet for this card type — never `0`,
   * which would falsely imply "confirmed not useful" instead of
   * "unmeasured." */
  readonly usefulRate: number | null;
}

export function summarizeCardFeedback(
  entries: readonly CardFeedbackEntry[],
): readonly CardTypeFeedbackSummary[] {
  const byType = new Map<string, { useful: number; notRelevant: number }>();

  for (const entry of entries) {
    const bucket = byType.get(entry.cardType) ?? {
      useful: 0,
      notRelevant: 0,
    };

    if (entry.feedback === "useful") {
      bucket.useful += 1;
    } else {
      bucket.notRelevant += 1;
    }

    byType.set(entry.cardType, bucket);
  }

  return [...byType.entries()]
    .map(([cardType, { useful, notRelevant }]) => {
      const total = useful + notRelevant;

      return {
        cardType,
        usefulCount: useful,
        notRelevantCount: notRelevant,
        usefulRate: total === 0 ? null : useful / total,
      };
    })
    .sort((a, b) => a.cardType.localeCompare(b.cardType));
}
