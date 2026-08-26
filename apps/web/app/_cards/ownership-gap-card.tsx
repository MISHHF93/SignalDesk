import { CardShell } from "./card-shell";
import type { CardComponentProps } from "./card-types";

/**
 * Mirrors `TaskRiskCard` exactly — no financial context, no owner (the
 * whole point of this card is that one doesn't exist yet) — including
 * `CardFeedbackButtons`, real for this card type since migration 0055
 * (`card_feedback_type_sync.sql`) widened `card_feedback_card_type_allowed`
 * to cover `ownership_gap`.
 */
export function OwnershipGapCard({
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
