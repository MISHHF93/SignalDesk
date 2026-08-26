import { CardShell } from "./card-shell";
import type { CardComponentProps } from "./card-types";

/**
 * The Goal Intelligence Engine's one real card (Prompt 22,
 * docs/product-vision-backlog.md, ADR 0035) — mirrors `InvoiceRiskCard`
 * exactly, except `financialContext` is genuinely absent for a count-unit
 * goal (e.g. task backlog), not just optional by contract, so this never
 * assumes it's present the way every other financial card can.
 */
export function GoalVarianceCard({
  card,
  createTaskAction,
  recordCardFeedbackAction,
}: CardComponentProps) {
  return (
    <CardShell
      card={card}
      createTaskAction={createTaskAction}
      {...(recordCardFeedbackAction ? { recordCardFeedbackAction } : {})}
    />
  );
}
