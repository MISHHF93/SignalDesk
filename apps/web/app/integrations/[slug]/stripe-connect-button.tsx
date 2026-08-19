"use client";

import { useActionState } from "react";

import {
  connectStripeAction,
  type ConnectStripeState,
} from "../../_actions/connect-stripe";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectStripeState = { error: null };

export function StripeConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectStripeAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Stripe…" : "Connect Stripe"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
