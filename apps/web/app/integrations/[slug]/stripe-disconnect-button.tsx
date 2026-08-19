"use client";

import { useActionState } from "react";

import {
  disconnectStripeAction,
  type DisconnectStripeState,
} from "../../_actions/disconnect-stripe";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectStripeState = { error: null };

export function StripeDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectStripeAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Stripe"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
