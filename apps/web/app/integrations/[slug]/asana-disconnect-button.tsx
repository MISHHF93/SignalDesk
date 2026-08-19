"use client";

import { useActionState } from "react";

import {
  disconnectAsanaAction,
  type DisconnectAsanaState,
} from "../../_actions/disconnect-asana";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectAsanaState = { error: null };

export function AsanaDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectAsanaAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Asana"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
