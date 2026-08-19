"use client";

import { useActionState } from "react";

import {
  connectLinearAction,
  type ConnectLinearState,
} from "../../_actions/connect-linear";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectLinearState = { error: null };

export function LinearConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectLinearAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Linear…" : "Connect Linear"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
