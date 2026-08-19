"use client";

import { useActionState } from "react";

import {
  cancelSubscriptionAction,
  type CancelSubscriptionState,
} from "../_actions/cancel-subscription";
import { Button } from "../_components/button";

const INITIAL_STATE: CancelSubscriptionState = { error: null };

export function CancelSubscriptionButton() {
  const [state, formAction, isPending] = useActionState(
    cancelSubscriptionAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Cancelling…" : "Cancel subscription"}
      </Button>
      {state.error ? (
        <p className="authError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
