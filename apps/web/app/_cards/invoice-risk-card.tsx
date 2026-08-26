import { CardShell } from "./card-shell";
import type { CardComponentProps } from "./card-types";
import { DraftActionButton } from "./draft-action-button";
import { InvoicePaymentScenarioButton } from "./invoice-payment-scenario-button";

export function InvoiceRiskCard({
  card,
  createTaskAction,
  simulateInvoicePaymentAction,
  recordCardFeedbackAction,
  draftInvoiceReminderAction,
  onAgentCardProduced,
}: CardComponentProps) {
  return (
    <CardShell
      card={card}
      createTaskAction={createTaskAction}
      {...(recordCardFeedbackAction ? { recordCardFeedbackAction } : {})}
      afterSummary={
        simulateInvoicePaymentAction && card.entity ? (
          <InvoicePaymentScenarioButton
            invoiceId={card.entity.id}
            simulateInvoicePaymentAction={simulateInvoicePaymentAction}
          />
        ) : null
      }
      footerActions={
        draftInvoiceReminderAction &&
        card.entity &&
        card.entity.kind === "invoice" ? (
          <DraftActionButton
            entityId={card.entity.id}
            action={draftInvoiceReminderAction}
            idleLabel="Draft reminder"
            errorPrefix="Couldn't draft a reminder."
            {...(onAgentCardProduced ? { onAgentCardProduced } : {})}
          />
        ) : null
      }
    />
  );
}
