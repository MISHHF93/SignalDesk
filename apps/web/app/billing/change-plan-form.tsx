"use client";

import { useState, useTransition } from "react";

import type {
  ChangePlanState,
  PreviewPlanChangeResult,
} from "../_actions/change-plan";
import { Button } from "../_components/button";

interface AvailablePlan {
  readonly planKey: string;
  readonly name: string;
}

function formatCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
}

export function ChangePlanForm({
  availablePlans,
  previewAction,
  changeAction,
}: {
  readonly availablePlans: readonly AvailablePlan[];
  readonly previewAction: (planKey: string) => Promise<PreviewPlanChangeResult>;
  readonly changeAction: (planKey: string) => Promise<ChangePlanState>;
}) {
  const [preview, setPreview] = useState<PreviewPlanChangeResult | null>(null);
  const [pendingPlanKey, setPendingPlanKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelectPlan(planKey: string) {
    setPendingPlanKey(planKey);
    setError(null);
    startTransition(async () => {
      const result = await previewAction(planKey);

      if (result.ok) {
        setPreview(result);
      } else {
        setError(result.error);
        setPendingPlanKey(null);
      }
    });
  }

  function handleConfirm() {
    if (!pendingPlanKey) {
      return;
    }

    startTransition(async () => {
      const result = await changeAction(pendingPlanKey);
      // A successful change redirects the whole page — this only runs on
      // failure.
      setError(result.error);
    });
  }

  function handleCancel() {
    setPreview(null);
    setPendingPlanKey(null);
    setError(null);
  }

  if (preview?.ok && pendingPlanKey) {
    const isCredit = preview.amountDueCents < 0;

    return (
      <div className="checkoutForm">
        <p className="dailyBriefMeta">
          Switching to {preview.planName} will {isCredit ? "credit" : "charge"}{" "}
          {formatCents(Math.abs(preview.amountDueCents), preview.currency)} now,
          prorated for the rest of your current billing period.
        </p>
        <Button
          variant="primary"
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
        >
          {isPending ? "Switching…" : `Confirm switch to ${preview.planName}`}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={handleCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        {error ? (
          <p className="authError" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="checkoutForm">
      <div
        className="categoryFilters"
        role="group"
        aria-label="Switch to a different plan"
      >
        {availablePlans.map((plan) => (
          <button
            key={plan.planKey}
            type="button"
            onClick={() => handleSelectPlan(plan.planKey)}
            disabled={isPending}
          >
            {isPending && pendingPlanKey === plan.planKey
              ? "Loading…"
              : `Switch to ${plan.name}`}
          </button>
        ))}
      </div>
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
