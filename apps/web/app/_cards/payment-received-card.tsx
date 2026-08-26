import { CardShell } from "./card-shell";
import type { CardComponentProps } from "./card-types";

/**
 * "What came in" — the one card type today that confirms good news
 * rather than flagging risk (ADR 0022). Mirrors `InvoiceRiskCard`'s shell
 * exactly; the only real difference is what the finding behind it means.
 */
export function PaymentReceivedCard({
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
