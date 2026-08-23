"use client";

import type { InvoicePaymentScenarioResult } from "@signaldesk/application";
import { useState, useTransition } from "react";

import type { SimulateInvoicePaymentAction } from "../_lib/actions";
import { Button } from "../_components/button";
import { formatCardCurrency } from "./format";

function formatExposure(
  exposure: InvoicePaymentScenarioResult["baseline"],
): string {
  if (exposure.length === 0) {
    return "$0";
  }

  return exposure
    .map((entry) => formatCardCurrency(entry.amountCents, entry.currency))
    .join(" + ");
}

/**
 * "What if this gets paid?" — a real, read-only simulation (Prompt 14,
 * `docs/product-vision-backlog.md`, ADR 0031). Never claims the invoice
 * *is* paid; only ever compares real current exposure against a labeled
 * hypothetical, matching the proposal's own "never mix simulation with
 * observed facts" rule.
 */
export function InvoicePaymentScenarioButton({
  invoiceId,
  simulateInvoicePaymentAction,
}: {
  readonly invoiceId: string;
  readonly simulateInvoicePaymentAction: SimulateInvoicePaymentAction;
}) {
  const [result, setResult] = useState<InvoicePaymentScenarioResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);

    startTransition(async () => {
      const outcome = await simulateInvoicePaymentAction(invoiceId);

      if (outcome.ok) {
        setResult(outcome.result);
      } else {
        setError(outcome.error);
      }
    });
  }

  return (
    <div className="invoiceScenario">
      <Button
        variant="ghost"
        type="button"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "Simulating…" : "What if this gets paid?"}
      </Button>
      {error ? (
        <p className="invoiceScenarioError" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <p className="invoiceScenarioResult" role="status">
          <span className="invoiceScenarioBadge">SIMULATION</span> Overdue
          receivables would go from {formatExposure(result.baseline)} to{" "}
          {formatExposure(result.scenario)} — nothing has actually changed.
        </p>
      ) : null}
    </div>
  );
}
