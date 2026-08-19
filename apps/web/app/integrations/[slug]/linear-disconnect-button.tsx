"use client";

import { useActionState } from "react";

import {
  disconnectLinearAction,
  type DisconnectLinearState,
} from "../../_actions/disconnect-linear";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectLinearState = { error: null };

export function LinearDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectLinearAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Linear"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
