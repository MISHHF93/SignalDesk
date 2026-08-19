"use client";

import { useActionState } from "react";

import {
  disconnectGmailAction,
  type DisconnectGmailState,
} from "../../_actions/disconnect-gmail";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectGmailState = { error: null };

export function GmailDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectGmailAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Gmail"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
